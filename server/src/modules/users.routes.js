import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import { cursorWhere, pageResult } from '../lib/pagination.js';
import { publicUser } from '../lib/presenter.js';
import { levelFor, streakFromDates } from '../lib/scoring.js';
import { userStats, writeAudit } from '../lib/progress.js';
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
      })),
      nextCursor: page.nextCursor,
    });
  } catch (error) {
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
