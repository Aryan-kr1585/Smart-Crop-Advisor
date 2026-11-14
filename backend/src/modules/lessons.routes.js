import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/errors.js';
import { cursorWhere, pageResult } from '../lib/pagination.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const statusEnum = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const page = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

function canEdit(user, authorId) {
  return user.role === 'ADMIN' || authorId === user.id;
}

export const lessonsRouter = Router();
lessonsRouter.use(requireAuth);

lessonsRouter.get('/', validate({ query: page }), async (req, res, next) => {
  try {
    const filters = [];
    if (req.user.role === 'STUDENT') filters.push({ status: 'PUBLISHED' });
    else if (req.user.role === 'TEACHER') {
      filters.push({ OR: [{ status: 'PUBLISHED' }, { authorId: req.user.id }] });
    }
    const cursor = cursorWhere(req.query.cursor);
    if (cursor.OR) filters.push(cursor);
    const where = filters.length ? { AND: filters } : {};
    const rows = await prisma.lesson.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: req.query.limit + 1,
      select: { id: true, title: true, status: true, publishedAt: true, authorId: true, createdAt: true },
    });
    const result = pageResult(rows, req.query.limit);
    res.json({
      items: result.items.map(({ createdAt, ...lesson }) => lesson),
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    next(error);
  }
});

lessonsRouter.get('/:lessonId', validate({
  params: z.object({ lessonId: z.string().uuid() }),
}), async (req, res, next) => {
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.lessonId },
      include: {
        quizzes: {
          where: req.user.role === 'STUDENT' ? { status: 'PUBLISHED' } : undefined,
          select: { id: true, title: true, status: true, attemptLimit: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!lesson || (req.user.role === 'STUDENT' && lesson.status !== 'PUBLISHED')) {
      next(notFound());
      return;
    }
    if (req.user.role === 'TEACHER' && lesson.status !== 'PUBLISHED' && lesson.authorId !== req.user.id) {
      next(notFound());
      return;
    }
    res.json({
      id: lesson.id,
      title: lesson.title,
      body: lesson.body,
      status: lesson.status,
      publishedAt: lesson.publishedAt,
      quizzes: lesson.quizzes,
    });
  } catch (error) {
    next(error);
  }
});

lessonsRouter.post('/', requireRoles('TEACHER', 'ADMIN'), validate({
  body: z.object({
    title: z.string().trim().min(3).max(140),
    body: z.string().trim().min(10).max(20000),
    status: statusEnum.default('DRAFT'),
  }),
}), async (req, res, next) => {
  try {
    const lesson = await prisma.lesson.create({
      data: {
        title: req.body.title,
        body: req.body.body,
        status: req.body.status,
        authorId: req.user.id,
        publishedAt: req.body.status === 'PUBLISHED' ? new Date() : null,
      },
    });
    res.status(201).json({ id: lesson.id, title: lesson.title, body: lesson.body, status: lesson.status });
  } catch (error) {
    next(error);
  }
});

lessonsRouter.patch('/:lessonId', requireRoles('TEACHER', 'ADMIN'), validate({
  params: z.object({ lessonId: z.string().uuid() }),
  body: z.object({
    title: z.string().trim().min(3).max(140).optional(),
    body: z.string().trim().min(10).max(20000).optional(),
    status: statusEnum.optional(),
  }),
}), async (req, res, next) => {
  try {
    const existing = await prisma.lesson.findUnique({ where: { id: req.params.lessonId } });
    if (!existing || !canEdit(req.user, existing.authorId)) {
      next(notFound());
      return;
    }
    const data = { ...req.body };
    if (req.body.status === 'PUBLISHED' && !existing.publishedAt) data.publishedAt = new Date();
    const lesson = await prisma.lesson.update({ where: { id: existing.id }, data });
    res.json({ id: lesson.id, title: lesson.title, body: lesson.body, status: lesson.status });
  } catch (error) {
    next(error);
  }
});
