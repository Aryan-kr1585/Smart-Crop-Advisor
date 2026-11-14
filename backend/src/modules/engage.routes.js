import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../lib/errors.js';
import { cursorWhere, pageResult } from '../lib/pagination.js';
import { writeAudit } from '../lib/progress.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const criteria = z.object({
  type: z.enum(['POINTS_AT_LEAST', 'APPROVED_SUBMISSIONS', 'QUIZZES_PASSED']),
  threshold: z.number().int().min(1).max(100000),
});

const page = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const badgesRouter = Router();
badgesRouter.use(requireAuth);

badgesRouter.get('/', async (req, res, next) => {
  try {
    const badges = await prisma.badge.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
    res.json({
      items: badges.map((badge) => ({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        criteria: badge.criteria,
      })),
    });
  } catch (error) {
    next(error);
  }
});

badgesRouter.post('/', requireRoles('ADMIN'), validate({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().min(4).max(300),
    criteria,
  }),
}), async (req, res, next) => {
  try {
    const badge = await prisma.$transaction(async (tx) => {
      const created = await tx.badge.create({ data: req.body });
      await writeAudit(tx, {
        actorId: req.user.id,
        action: 'BADGE_CREATE',
        entityType: 'Badge',
        entityId: created.id,
        metadata: { name: created.name },
      });
      return created;
    });
    res.status(201).json({ id: badge.id, name: badge.name, description: badge.description, criteria: badge.criteria });
  } catch (error) {
    if (error.code === 'P2002') {
      next(conflict('A badge with this name already exists'));
      return;
    }
    next(error);
  }
});

export const challengesRouter = Router();
challengesRouter.use(requireAuth);

challengesRouter.get('/', validate({ query: page }), async (req, res, next) => {
  try {
    const now = new Date();
    const filters = [];
    if (req.user.role === 'STUDENT') {
      filters.push({
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gte: now },
        OR: [{ schoolId: null }, { schoolId: req.user.schoolId }],
      });
    }
    const cursor = cursorWhere(req.query.cursor);
    if (cursor.OR) filters.push(cursor);
    const rows = await prisma.challenge.findMany({
      where: filters.length ? { AND: filters } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: req.query.limit + 1,
      include: {
        tasks: {
          include: { task: { select: { id: true, title: true, points: true, status: true } } },
        },
      },
    });
    const result = pageResult(rows, req.query.limit);
    res.json({
      items: result.items.map((challenge) => ({
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        startsAt: challenge.startsAt,
        endsAt: challenge.endsAt,
        status: challenge.status,
        schoolId: challenge.schoolId,
        tasks: challenge.tasks
          .map((link) => link.task)
          .filter((task) => req.user.role !== 'STUDENT' || task.status === 'PUBLISHED'),
      })),
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    next(error);
  }
});

challengesRouter.post('/', requireRoles('TEACHER', 'ADMIN'), validate({
  body: z.object({
    title: z.string().trim().min(3).max(140),
    description: z.string().trim().min(4).max(2000),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    status: z.enum(['DRAFT', 'ACTIVE', 'ENDED']).default('ACTIVE'),
    schoolId: z.string().uuid().nullable().optional(),
    taskIds: z.array(z.string().uuid()).min(1).max(20),
  }).superRefine((body, ctx) => {
    if (new Date(body.endsAt) <= new Date(body.startsAt)) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End must be after start' });
    }
  }),
}), async (req, res, next) => {
  try {
    if (req.user.role === 'TEACHER' && req.body.schoolId && req.body.schoolId !== req.user.schoolId) {
      next(notFound());
      return;
    }
    const tasks = await prisma.task.findMany({ where: { id: { in: req.body.taskIds } } });
    if (tasks.length !== req.body.taskIds.length) {
      next(notFound('One or more tasks were not found'));
      return;
    }
    const schoolId = req.user.role === 'TEACHER' ? req.user.schoolId : (req.body.schoolId ?? null);
    const challenge = await prisma.challenge.create({
      data: {
        title: req.body.title,
        description: req.body.description,
        startsAt: new Date(req.body.startsAt),
        endsAt: new Date(req.body.endsAt),
        status: req.body.status,
        schoolId,
        tasks: { create: req.body.taskIds.map((taskId) => ({ taskId })) },
      },
    });
    res.status(201).json({
      id: challenge.id,
      title: challenge.title,
      startsAt: challenge.startsAt,
      endsAt: challenge.endsAt,
      status: challenge.status,
    });
  } catch (error) {
    next(error);
  }
});

export const leaderboardRouter = Router();
leaderboardRouter.use(requireAuth);

leaderboardRouter.get('/', validate({
  query: z.object({
    schoolId: z.string().uuid().optional(),
    period: z.enum(['all', '30d']).default('all'),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
}), async (req, res, next) => {
  try {
    let schoolId = req.query.schoolId;
    if (req.user.role === 'STUDENT') schoolId = req.user.schoolId;
    if (req.user.role === 'TEACHER') schoolId = req.user.schoolId;
    if (!schoolId) {
      res.json({ items: [], nextCursor: null, schoolId: null, period: req.query.period, me: null });
      return;
    }
    if (req.user.role !== 'ADMIN' && schoolId !== req.user.schoolId) {
      next(notFound());
      return;
    }
    const since = req.query.period === '30d' ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : null;
    const students = await prisma.user.findMany({
      where: { schoolId, role: 'STUDENT', status: 'ACTIVE' },
      select: { id: true, displayName: true },
    });
    const sums = await prisma.pointLedger.groupBy({
      by: ['userId'],
      where: {
        userId: { in: students.map((student) => student.id) },
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      _sum: { amount: true },
    });
    const pointsByUser = new Map(sums.map((row) => [row.userId, row._sum.amount ?? 0]));
    const ranked = students
      .map((student) => ({ ...student, points: pointsByUser.get(student.id) ?? 0 }))
      .sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName));
    let lastPoints = null;
    let lastRank = 0;
    const withRank = ranked.map((row, index) => {
      const rank = row.points === lastPoints ? lastRank : index + 1;
      lastPoints = row.points;
      lastRank = rank;
      return { rank, displayName: row.displayName, points: row.points, userId: row.id };
    });
    let start = 0;
    if (req.query.cursor) {
      const parsed = Number(Buffer.from(req.query.cursor, 'base64url').toString());
      if (Number.isInteger(parsed) && parsed >= 0) start = parsed;
    }
    const slice = withRank.slice(start, start + req.query.limit);
    const next = start + req.query.limit;
    const me = withRank.find((row) => row.userId === req.user.id);
    res.json({
      schoolId,
      period: req.query.period,
      items: slice.map(({ userId, ...row }) => row),
      nextCursor: next < withRank.length ? Buffer.from(String(next)).toString('base64url') : null,
      me: me ? { rank: me.rank, points: me.points, displayName: me.displayName } : null,
    });
  } catch (error) {
    next(error);
  }
});

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', validate({
  query: page.extend({ unread: z.enum(['true', 'false']).optional() }),
}), async (req, res, next) => {
  try {
    const filters = [{ userId: req.user.id }];
    if (req.query.unread === 'true') filters.push({ readAt: null });
    const cursor = cursorWhere(req.query.cursor);
    if (cursor.OR) filters.push(cursor);
    const rows = await prisma.notification.findMany({
      where: { AND: filters },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: req.query.limit + 1,
    });
    const result = pageResult(rows, req.query.limit);
    const unreadCount = await prisma.notification.count({ where: { userId: req.user.id, readAt: null } });
    res.json({
      unreadCount,
      items: result.items.map((item) => ({
        id: item.id,
        type: item.type,
        payload: item.payload,
        readAt: item.readAt,
        createdAt: item.createdAt,
      })),
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch('/:id/read', validate({
  params: z.object({ id: z.string().uuid() }),
}), async (req, res, next) => {
  try {
    const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user.id) {
      next(notFound());
      return;
    }
    const updated = existing.readAt
      ? existing
      : await prisma.notification.update({ where: { id: existing.id }, data: { readAt: new Date() } });
    res.json({ id: updated.id, readAt: updated.readAt });
  } catch (error) {
    next(error);
  }
});
