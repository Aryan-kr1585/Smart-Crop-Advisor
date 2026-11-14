import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, conflict, notFound } from '../lib/errors.js';
import { cursorWhere, pageResult } from '../lib/pagination.js';
import { awardPoints, evaluateBadges } from '../lib/progress.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const page = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

async function sharesClass(teacherId, studentId) {
  return prisma.classMembership.findFirst({
    where: {
      userId: studentId,
      status: 'ACTIVE',
      class: { memberships: { some: { userId: teacherId, status: 'ACTIVE' } } },
    },
  });
}

function taskVisible(task, user, now) {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'TEACHER') return task.status === 'PUBLISHED' || task.authorId === user.id;
  if (task.status !== 'PUBLISHED') return false;
  if (task.startsAt && task.startsAt > now) return false;
  return true;
}

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

tasksRouter.get('/', validate({ query: page.omit({ status: true }) }), async (req, res, next) => {
  try {
    const now = new Date();
    const filters = [];
    if (req.user.role === 'STUDENT') {
      filters.push({ status: 'PUBLISHED', OR: [{ startsAt: null }, { startsAt: { lte: now } }] });
    } else if (req.user.role === 'TEACHER') {
      filters.push({ OR: [{ status: 'PUBLISHED' }, { authorId: req.user.id }] });
    }
    const cursor = cursorWhere(req.query.cursor);
    if (cursor.OR) filters.push(cursor);
    const studentView = req.user.role === 'STUDENT';
    const rows = await prisma.task.findMany({
      where: filters.length ? { AND: filters } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: req.query.limit + 1,
      include: studentView
        ? { submissions: { where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 1 } }
        : undefined,
    });
    const result = pageResult(rows, req.query.limit);
    res.json({
      items: result.items.filter((task) => taskVisible(task, req.user, now)).map((task) => ({
        id: task.id,
        title: task.title,
        instructions: task.instructions,
        status: task.status,
        points: task.points,
        startsAt: task.startsAt,
        dueAt: task.dueAt,
        requiresReview: task.requiresReview,
        mySubmission: task.submissions?.[0]
          ? { id: task.submissions[0].id, status: task.submissions[0].status }
          : null,
      })),
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    next(error);
  }
});

tasksRouter.get('/:taskId', validate({
  params: z.object({ taskId: z.string().uuid() }),
}), async (req, res, next) => {
  try {
    const studentView = req.user.role === 'STUDENT';
    const task = await prisma.task.findUnique({
      where: { id: req.params.taskId },
      include: studentView
        ? { submissions: { where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 1 } }
        : undefined,
    });
    if (!task || !taskVisible(task, req.user, new Date())) {
      next(notFound());
      return;
    }
    const latest = task.submissions?.[0];
    res.json({
      id: task.id,
      title: task.title,
      instructions: task.instructions,
      status: task.status,
      points: task.points,
      startsAt: task.startsAt,
      dueAt: task.dueAt,
      requiresReview: task.requiresReview,
      mySubmission: latest ? {
        id: latest.id,
        status: latest.status,
        text: latest.text,
        assetId: latest.assetId,
        reviewNote: latest.reviewNote,
        reviewedAt: latest.reviewedAt,
      } : null,
    });
  } catch (error) {
    next(error);
  }
});

tasksRouter.post('/', requireRoles('TEACHER', 'ADMIN'), validate({
  body: z.object({
    title: z.string().trim().min(3).max(140),
    instructions: z.string().trim().min(10).max(8000),
    points: z.number().int().min(0).max(500),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('PUBLISHED'),
    startsAt: z.string().datetime().optional(),
    dueAt: z.string().datetime().optional(),
    requiresReview: z.boolean().default(true),
  }).superRefine((body, ctx) => {
    if (body.startsAt && body.dueAt && new Date(body.dueAt) <= new Date(body.startsAt)) {
      ctx.addIssue({ code: 'custom', path: ['dueAt'], message: 'Due date must be after the start date' });
    }
  }),
}), async (req, res, next) => {
  try {
    const task = await prisma.task.create({
      data: {
        title: req.body.title,
        instructions: req.body.instructions,
        points: req.body.points,
        status: req.body.status,
        startsAt: req.body.startsAt ? new Date(req.body.startsAt) : null,
        dueAt: req.body.dueAt ? new Date(req.body.dueAt) : null,
        requiresReview: req.body.requiresReview,
        authorId: req.user.id,
      },
    });
    res.status(201).json({
      id: task.id,
      title: task.title,
      instructions: task.instructions,
      points: task.points,
      dueAt: task.dueAt,
      status: task.status,
    });
  } catch (error) {
    next(error);
  }
});

tasksRouter.patch('/:taskId', requireRoles('TEACHER', 'ADMIN'), validate({
  params: z.object({ taskId: z.string().uuid() }),
  body: z.object({
    title: z.string().trim().min(3).max(140).optional(),
    instructions: z.string().trim().min(10).max(8000).optional(),
    points: z.number().int().min(0).max(500).optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
    dueAt: z.string().datetime().nullable().optional(),
    requiresReview: z.boolean().optional(),
  }),
}), async (req, res, next) => {
  try {
    const existing = await prisma.task.findUnique({ where: { id: req.params.taskId } });
    if (!existing || (req.user.role !== 'ADMIN' && existing.authorId !== req.user.id)) {
      next(notFound());
      return;
    }
    const data = { ...req.body };
    if (req.body.dueAt !== undefined) data.dueAt = req.body.dueAt ? new Date(req.body.dueAt) : null;
    const task = await prisma.task.update({ where: { id: existing.id }, data });
    res.json({ id: task.id, title: task.title, status: task.status, points: task.points, dueAt: task.dueAt });
  } catch (error) {
    next(error);
  }
});

tasksRouter.post('/:taskId/submissions', requireRoles('STUDENT'), validate({
  params: z.object({ taskId: z.string().uuid() }),
  body: z.object({
    text: z.string().trim().max(4000).optional(),
    assetId: z.string().uuid().optional(),
  }).refine((body) => body.text || body.assetId, { message: 'Add a description or an image', path: ['text'] }),
}), async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
    const now = new Date();
    if (!task || !taskVisible(task, req.user, now)) {
      next(notFound());
      return;
    }
    if (task.dueAt && task.dueAt < now) {
      next(conflict('This task is past its deadline'));
      return;
    }
    if (req.body.assetId) {
      const asset = await prisma.uploadAsset.findUnique({ where: { id: req.body.assetId } });
      if (!asset || asset.userId !== req.user.id) {
        next(notFound('Upload not found'));
        return;
      }
    }
    const status = task.requiresReview ? 'PENDING' : 'APPROVED';
    const submission = await prisma.$transaction(async (tx) => {
      const open = await tx.submission.findFirst({
        where: { taskId: task.id, userId: req.user.id, status: { in: ['PENDING', 'APPROVED'] } },
      });
      if (open) throw conflict('You already have a submission for this task');
      const created = await tx.submission.create({
        data: {
          taskId: task.id,
          userId: req.user.id,
          status,
          text: req.body.text,
          assetId: req.body.assetId,
          reviewedAt: status === 'APPROVED' ? now : null,
        },
      });
      if (status === 'APPROVED' && task.points > 0) {
        await awardPoints(tx, {
          userId: req.user.id,
          amount: task.points,
          reason: `Task completed: ${task.title}`,
          sourceType: 'SUBMISSION',
          sourceId: created.id,
          idempotencyKey: `submission:${created.id}`,
        });
        await evaluateBadges(tx, req.user.id);
      }
      return created;
    });
    res.status(201).json({ id: submission.id, status: submission.status });
  } catch (error) {
    next(error);
  }
});

export const submissionsRouter = Router();
submissionsRouter.use(requireAuth);

submissionsRouter.get('/', requireRoles('TEACHER', 'ADMIN'), validate({ query: page }), async (req, res, next) => {
  try {
    const filters = [];
    if (req.query.status) filters.push({ status: req.query.status });
    if (req.user.role === 'TEACHER') {
      const classes = await prisma.classMembership.findMany({
        where: { userId: req.user.id, status: 'ACTIVE' },
        select: { classId: true },
      });
      filters.push({
        user: { memberships: { some: { classId: { in: classes.map((row) => row.classId) }, status: 'ACTIVE' } } },
      });
    }
    const cursor = cursorWhere(req.query.cursor);
    if (cursor.OR) filters.push(cursor);
    const rows = await prisma.submission.findMany({
      where: filters.length ? { AND: filters } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: req.query.limit + 1,
      include: {
        task: { select: { id: true, title: true, points: true, instructions: true } },
        user: { select: { id: true, displayName: true } },
      },
    });
    const result = pageResult(rows, req.query.limit);
    res.json({
      items: result.items.map((item) => ({
        id: item.id,
        status: item.status,
        text: item.text,
        assetId: item.assetId,
        reviewNote: item.reviewNote,
        createdAt: item.createdAt,
        task: item.task,
        student: item.user,
      })),
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    next(error);
  }
});

submissionsRouter.post('/:id/review', requireRoles('TEACHER', 'ADMIN'), validate({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    reviewNote: z.string().trim().max(500).optional(),
  }).superRefine((body, ctx) => {
    if (body.decision === 'REJECTED' && !body.reviewNote) {
      ctx.addIssue({ code: 'custom', path: ['reviewNote'], message: 'Add a reason when rejecting' });
    }
  }),
}), async (req, res, next) => {
  try {
    const existing = await prisma.submission.findUnique({
      where: { id: req.params.id },
      include: { task: true, user: true },
    });
    if (!existing) {
      next(notFound());
      return;
    }
    if (req.user.role === 'TEACHER') {
      const shared = await sharesClass(req.user.id, existing.userId);
      if (!shared) {
        next(notFound());
        return;
      }
    }
    if (existing.status !== 'PENDING') {
      next(conflict('This submission has already been reviewed'));
      return;
    }
    const reviewed = await prisma.$transaction(async (tx) => {
      const current = await tx.submission.findUnique({ where: { id: existing.id } });
      if (!current || current.status !== 'PENDING') throw conflict('This submission has already been reviewed');
      const updated = await tx.submission.update({
        where: { id: existing.id },
        data: {
          status: req.body.decision,
          reviewerId: req.user.id,
          reviewedAt: new Date(),
          reviewNote: req.body.reviewNote,
        },
      });
      let awardedPoints = 0;
      if (req.body.decision === 'APPROVED' && existing.task.points > 0) {
        const entry = await awardPoints(tx, {
          userId: existing.userId,
          amount: existing.task.points,
          reason: `Task approved: ${existing.task.title}`,
          sourceType: 'SUBMISSION',
          sourceId: existing.id,
          idempotencyKey: `submission:${existing.id}`,
        });
        awardedPoints = entry ? existing.task.points : 0;
        await evaluateBadges(tx, existing.userId);
      }
      await tx.notification.create({
        data: {
          userId: existing.userId,
          type: 'SUBMISSION_REVIEWED',
          payload: {
            submissionId: existing.id,
            taskTitle: existing.task.title,
            decision: req.body.decision,
            reviewNote: req.body.reviewNote ?? null,
            awardedPoints,
          },
        },
      });
      return { updated, awardedPoints };
    });
    res.json({ id: reviewed.updated.id, status: reviewed.updated.status, awardedPoints: reviewed.awardedPoints });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(error);
  }
});
