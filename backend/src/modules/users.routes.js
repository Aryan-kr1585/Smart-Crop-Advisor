import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, conflict, forbidden, notFound } from '../lib/errors.js';
import { cursorWhere, pageResult } from '../lib/pagination.js';
import { publicUser } from '../lib/presenter.js';
import { levelFor, streakFromDates } from '../lib/scoring.js';
import { userStats, writeAudit } from '../lib/progress.js';
import { removeStoredAsset } from '../lib/storage.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const pageQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  schoolId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
});

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get('/me', (req, res) => {
  res.json(publicUser(req.user));
});

usersRouter.get('/me/preferences', (req, res) => {
  res.json({ notificationsEnabled: req.user.notificationsEnabled });
});

usersRouter.patch('/me/preferences', validate({
  body: z.object({ notificationsEnabled: z.boolean() }),
}), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { notificationsEnabled: req.body.notificationsEnabled },
      select: { notificationsEnabled: true },
    });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/me/export', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [profile, memberships, submissions, attempts, ledger, badges, notifications] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, displayName: true, role: true, status: true, schoolId: true, notificationsEnabled: true, createdAt: true } }),
      prisma.classMembership.findMany({ where: { userId }, include: { class: { include: { school: { select: { id: true, name: true } } } } } }),
      prisma.submission.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { task: { select: { id: true, title: true } }, asset: { select: { mimeType: true, size: true, createdAt: true } } } }),
      prisma.quizAttempt.findMany({ where: { userId }, orderBy: { submittedAt: 'desc' }, include: { quiz: { select: { id: true, title: true } } } }),
      prisma.pointLedger.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.userBadge.findMany({ where: { userId }, include: { badge: { select: { name: true, description: true } } } }),
      prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { type: true, payload: true, readAt: true, createdAt: true } }),
    ]);
    if (!profile) {
      next(notFound());
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ecoquest-data-${userId}.json"`);
    res.json({ exportedAt: new Date().toISOString(), profile, memberships, submissions, quizAttempts: attempts, pointLedger: ledger, badges, notifications });
  } catch (error) {
    next(error);
  }
});

usersRouter.delete('/me', validate({
  body: z.object({ confirmation: z.literal('DELETE MY ACCOUNT') }),
}), async (req, res, next) => {
  try {
    if (req.user.role === 'ADMIN') {
      const activeAdmins = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
      if (activeAdmins <= 1) {
        next(conflict('The last active admin account cannot be deleted'));
        return;
      }
    }
    const assets = await prisma.uploadAsset.findMany({ where: { userId: req.user.id } });
    try {
      for (const asset of assets) await removeStoredAsset(asset);
    } catch {
      next(new AppError(503, 'EVIDENCE_CLEANUP_FAILED', 'Evidence could not be fully removed. Try again later.'));
      return;
    }
    const replacementPasswordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    const deletedAt = new Date();
    await prisma.$transaction(async (tx) => {
      const assetIds = assets.map((asset) => asset.id);
      await tx.submission.updateMany({
        where: { userId: req.user.id },
        data: { text: null, reviewNote: null, assetId: null },
      });
      if (assetIds.length) await tx.submission.updateMany({ where: { assetId: { in: assetIds } }, data: { assetId: null } });
      await tx.submission.updateMany({ where: { reviewerId: req.user.id }, data: { reviewerId: null } });
      await tx.uploadAsset.deleteMany({ where: { userId: req.user.id } });
      await tx.passwordResetToken.deleteMany({ where: { userId: req.user.id } });
      await tx.notification.deleteMany({ where: { userId: req.user.id } });
      await tx.userBadge.deleteMany({ where: { userId: req.user.id } });
      await tx.classMembership.deleteMany({ where: { userId: req.user.id } });
      await tx.lesson.updateMany({ where: { authorId: req.user.id }, data: { authorId: null } });
      await tx.quiz.updateMany({ where: { authorId: req.user.id }, data: { authorId: null } });
      await tx.task.updateMany({ where: { authorId: req.user.id }, data: { authorId: null } });
      await tx.user.update({
        where: { id: req.user.id },
        data: {
          email: `deleted-${req.user.id}@deleted.invalid`,
          displayName: 'Deleted account',
          passwordHash: replacementPasswordHash,
          status: 'SUSPENDED',
          schoolId: null,
          notificationsEnabled: true,
          tokenVersion: { increment: 1 },
        },
      });
      await writeAudit(tx, {
        actorId: req.user.id,
        action: 'USER_ERASE',
        entityType: 'User',
        entityId: req.user.id,
        metadata: { requestedAt: deletedAt.toISOString(), retainedRecords: ['quizAttempts', 'pointLedger', 'auditEvents'] },
      });
    });
    res.json({ success: true, message: 'Account identifiers and uploaded evidence were removed. Required score and audit history remain under an anonymized record.' });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/me', validate({
  body: z.object({ displayName: z.string().trim().min(2).max(80) }),
}), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { displayName: req.body.displayName },
    });
    res.json(publicUser(user));
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/me/points', validate({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
}), async (req, res, next) => {
  try {
    const stats = await userStats(prisma, req.user.id);
    const rows = await prisma.pointLedger.findMany({
      where: { userId: req.user.id, ...cursorWhere(req.query.cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: req.query.limit + 1,
    });
    const page = pageResult(rows, req.query.limit);
    res.json({
      total: stats.points,
      level: levelFor(stats.points),
      streak: streakFromDates(stats.activeDates, new Date()),
      entries: page.items.map((entry) => ({
        id: entry.id,
        amount: entry.amount,
        reason: entry.reason,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        createdAt: entry.createdAt,
      })),
      nextCursor: page.nextCursor,
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/me/badges', async (req, res, next) => {
  try {
    const awards = await prisma.userBadge.findMany({
      where: { userId: req.user.id },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' },
    });
    res.json({
      items: awards.map((award) => ({
        badgeId: award.badgeId,
        name: award.badge.name,
        description: award.badge.description,
        earnedAt: award.earnedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/', requireRoles('ADMIN', 'TEACHER'), validate({ query: pageQuery }), async (req, res, next) => {
  try {
    const where = { ...cursorWhere(req.query.cursor) };
    if (req.user.role === 'ADMIN') {
      if (req.query.schoolId) where.schoolId = req.query.schoolId;
    } else {
      where.schoolId = req.user.schoolId ?? '00000000-0000-0000-0000-000000000000';
      where.role = 'STUDENT';
    }
    if (req.query.classId) {
      if (req.user.role === 'TEACHER') {
        const allowed = await prisma.classMembership.findFirst({
          where: { classId: req.query.classId, userId: req.user.id, status: 'ACTIVE' },
        });
        if (!allowed) {
          next(notFound());
          return;
        }
      }
      where.memberships = { some: { classId: req.query.classId, status: 'ACTIVE' } };
    } else if (req.user.role === 'TEACHER') {
      const classes = await prisma.classMembership.findMany({
        where: { userId: req.user.id, status: 'ACTIVE' },
        select: { classId: true },
      });
      where.memberships = { some: { classId: { in: classes.map((row) => row.classId) }, status: 'ACTIVE' } };
    }
    const rows = await prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: req.query.limit + 1,
    });
    const page = pageResult(rows, req.query.limit);
    res.json({ items: page.items.map(publicUser), nextCursor: page.nextCursor });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/:userId', requireRoles('ADMIN'), validate({
  params: z.object({ userId: z.string().uuid() }),
  body: z.object({
    displayName: z.string().trim().min(2).max(80).optional(),
    role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
    schoolId: z.string().uuid().nullable().optional(),
  }).refine((body) => Object.keys(body).length > 0, { message: 'No changes provided' }),
}), async (req, res, next) => {
  try {
    const existing = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!existing) {
      next(notFound());
      return;
    }
    if (req.body.role && req.body.role !== 'ADMIN' && existing.role === 'ADMIN') {
      const admins = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
      if (admins <= 1) {
        next(conflict('The last active admin cannot be changed'));
        return;
      }
    }
    if (req.body.schoolId) {
      const school = await prisma.school.findUnique({ where: { id: req.body.schoolId } });
      if (!school) {
        next(notFound('School not found'));
        return;
      }
    }
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: existing.id }, data: req.body });
      await writeAudit(tx, {
        actorId: req.user.id,
        action: 'USER_UPDATE',
        entityType: 'User',
        entityId: updated.id,
        metadata: { role: req.body.role, status: req.body.status, schoolId: req.body.schoolId },
      });
      return updated;
    });
    res.json(publicUser(user));
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/:userId/points', requireRoles('ADMIN', 'TEACHER'), validate({
  params: z.object({ userId: z.string().uuid() }),
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
}), async (req, res, next) => {
  try {
    const student = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!student) {
      next(notFound());
      return;
    }
    if (req.user.role === 'TEACHER') {
      const shared = await prisma.classMembership.findFirst({
        where: {
          userId: student.id,
          status: 'ACTIVE',
          class: { memberships: { some: { userId: req.user.id, status: 'ACTIVE' } } },
        },
      });
      if (!shared) {
        next(notFound());
        return;
      }
    }
    const stats = await userStats(prisma, student.id);
    const rows = await prisma.pointLedger.findMany({
      where: { userId: student.id, ...cursorWhere(req.query.cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: req.query.limit + 1,
    });
    const page = pageResult(rows, req.query.limit);
    const reversedEntries = req.user.role === 'ADMIN' && page.items.length
      ? await prisma.pointLedger.findMany({
        where: { sourceType: 'REVERSAL', sourceId: { in: page.items.map((entry) => entry.id) } },
        select: { sourceId: true },
      })
      : [];
    const reversedIds = new Set(reversedEntries.map((entry) => entry.sourceId));
    res.json({
      userId: student.id,
      displayName: student.displayName,
      total: stats.points,
      level: levelFor(stats.points),
      entries: page.items.map((entry) => ({
        id: entry.id,
        amount: entry.amount,
        reason: entry.reason,
        createdAt: entry.createdAt,
        ...(req.user.role === 'ADMIN' ? { reversed: reversedIds.has(entry.id) } : {}),
      })),
      nextCursor: page.nextCursor,
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.post('/:userId/points/:entryId/reversal', requireRoles('ADMIN'), validate({
  params: z.object({ userId: z.string().uuid(), entryId: z.string().uuid() }),
  body: z.object({ reason: z.string().trim().min(4).max(500) }),
}), async (req, res, next) => {
  try {
    const reversal = await prisma.$transaction(async (tx) => {
      const source = await tx.pointLedger.findFirst({
        where: { id: req.params.entryId, userId: req.params.userId },
      });
      if (!source || source.amount <= 0 || source.sourceType === 'REVERSAL') throw notFound('Reversible point award not found');
      const idempotencyKey = `reversal:${source.id}`;
      const existingReversal = await tx.pointLedger.findUnique({ where: { idempotencyKey } });
      if (existingReversal) throw conflict('This point entry has already been reversed');
      const created = await tx.pointLedger.create({
        data: {
          userId: source.userId,
          amount: -source.amount,
          reason: `Reversal: ${req.body.reason}`,
          sourceType: 'REVERSAL',
          sourceId: source.id,
          idempotencyKey,
        },
      });
      await writeAudit(tx, {
        actorId: req.user.id,
        action: 'POINTS_REVERSE',
        entityType: 'PointLedger',
        entityId: created.id,
        metadata: { userId: source.userId, originalEntryId: source.id, amount: created.amount, reason: req.body.reason },
      });
      return created;
    });
    res.status(201).json({ id: reversal.id, amount: reversal.amount, originalEntryId: reversal.sourceId });
  } catch (error) {
    if (error.code === 'P2002') {
      next(conflict('This point entry has already been reversed'));
      return;
    }
    next(error);
  }
});

export function teacherOnly(req, res, next) {
  if (req.user.role === 'STUDENT') {
    next(forbidden());
    return;
  }
  next();
}
