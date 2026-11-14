import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, conflict, forbidden, notFound } from '../lib/errors.js';
import { cursorWhere, pageResult } from '../lib/pagination.js';
import { awardPoints, evaluateBadges } from '../lib/progress.js';
import { scoreAttempt } from '../lib/scoring.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const optionSchema = z.object({
  label: z.string().trim().min(1).max(300),
  isCorrect: z.boolean(),
});

const questionSchema = z.object({
  prompt: z.string().trim().min(3).max(1000),
  points: z.number().int().min(1).max(100).default(10),
  options: z.array(optionSchema).min(2).max(6),
}).superRefine((question, ctx) => {
  const correct = question.options.filter((option) => option.isCorrect).length;
  if (correct !== 1) {
    ctx.addIssue({ code: 'custom', message: 'Each question needs exactly one correct option', path: ['options'] });
  }
});

const quizBody = z.object({
  title: z.string().trim().min(3).max(140),
  lessonId: z.string().uuid().nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  attemptLimit: z.number().int().min(1).max(20).nullable().default(3),
  questions: z.array(questionSchema).min(1).max(20),
});

const quizUpdateBody = z.object({
  title: z.string().trim().min(3).max(140).optional(),
  lessonId: z.string().uuid().nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  attemptLimit: z.number().int().min(1).max(20).nullable().optional(),
  questions: z.array(questionSchema).min(1).max(20).optional(),
}).refine((body) => Object.keys(body).length > 0, { message: 'No changes provided' });

const attemptBody = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    optionId: z.string().uuid(),
  })).min(1),
}).superRefine((body, ctx) => {
  const questionIds = body.answers.map((answer) => answer.questionId);
  if (new Set(questionIds).size !== questionIds.length) {
    ctx.addIssue({ code: 'custom', path: ['answers'], message: 'Each question can be answered only once' });
  }
});

function publicQuiz(quiz, revealAnswers) {
  return {
    id: quiz.id,
    title: quiz.title,
    status: quiz.status,
    lessonId: quiz.lessonId,
    attemptLimit: quiz.attemptLimit,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      type: question.type,
      position: question.position,
      points: question.points,
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
        position: option.position,
        ...(revealAnswers ? { isCorrect: option.isCorrect } : {}),
      })),
    })),
  };
}

export const quizzesRouter = Router();
quizzesRouter.use(requireAuth);

quizzesRouter.get('/', requireRoles('TEACHER', 'ADMIN'), validate({
  query: z.object({ cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }),
}), async (req, res, next) => {
  try {
    const filters = [];
    if (req.user.role === 'TEACHER') filters.push({ OR: [{ status: 'PUBLISHED' }, { authorId: req.user.id }] });
    const cursor = cursorWhere(req.query.cursor);
    if (cursor.OR) filters.push(cursor);
    const rows = await prisma.quiz.findMany({
      where: filters.length ? { AND: filters } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: req.query.limit + 1,
      include: {
        lesson: { select: { title: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    });
    const result = pageResult(rows, req.query.limit);
    res.json({
      items: result.items.map((quiz) => ({
        id: quiz.id,
        title: quiz.title,
        status: quiz.status,
        lessonId: quiz.lessonId,
        lessonTitle: quiz.lesson?.title ?? null,
        attemptLimit: quiz.attemptLimit,
        questionsCount: quiz._count.questions,
        attemptsCount: quiz._count.attempts,
        canEdit: (req.user.role === 'ADMIN' || quiz.authorId === req.user.id) && quiz._count.attempts === 0,
      })),
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    next(error);
  }
});

quizzesRouter.get('/:quizId', validate({
  params: z.object({ quizId: z.string().uuid() }),
}), async (req, res, next) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.quizId },
      include: {
        questions: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } },
      },
    });
    if (!quiz) {
      next(notFound());
      return;
    }
    const reveal = req.user.role !== 'STUDENT';
    if (req.user.role === 'STUDENT' && quiz.status !== 'PUBLISHED') {
      next(notFound());
      return;
    }
    if (req.user.role === 'TEACHER' && quiz.status !== 'PUBLISHED' && quiz.authorId !== req.user.id) {
      next(notFound());
      return;
    }
    const attemptsUsed = req.user.role === 'STUDENT'
      ? await prisma.quizAttempt.count({ where: { quizId: quiz.id, userId: req.user.id } })
      : undefined;
    res.json({ ...publicQuiz(quiz, reveal), attemptsUsed });
  } catch (error) {
    next(error);
  }
});

quizzesRouter.post('/', requireRoles('TEACHER', 'ADMIN'), validate({ body: quizBody }), async (req, res, next) => {
  try {
    if (req.body.lessonId) {
      const lesson = await prisma.lesson.findUnique({ where: { id: req.body.lessonId } });
      if (!lesson) {
        next(notFound('Lesson not found'));
        return;
      }
    }
    const quiz = await prisma.quiz.create({
      data: {
        title: req.body.title,
        lessonId: req.body.lessonId ?? null,
        status: req.body.status,
        attemptLimit: req.body.attemptLimit,
        authorId: req.user.id,
        questions: {
          create: req.body.questions.map((question, questionIndex) => ({
            prompt: question.prompt,
            points: question.points,
            position: questionIndex + 1,
            options: {
              create: question.options.map((option, optionIndex) => ({
                label: option.label,
                isCorrect: option.isCorrect,
                position: optionIndex + 1,
              })),
            },
          })),
        },
      },
      include: {
        questions: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } },
      },
    });
    res.status(201).json(publicQuiz(quiz, true));
  } catch (error) {
    next(error);
  }
});

quizzesRouter.patch('/:quizId', requireRoles('TEACHER', 'ADMIN'), validate({
  params: z.object({ quizId: z.string().uuid() }),
  body: quizUpdateBody,
}), async (req, res, next) => {
  try {
    const quiz = await prisma.$transaction(async (tx) => {
      const existing = await tx.quiz.findUnique({ where: { id: req.params.quizId } });
      if (!existing || (req.user.role !== 'ADMIN' && existing.authorId !== req.user.id)) {
        throw notFound();
      }
      const attempts = await tx.quizAttempt.count({ where: { quizId: existing.id } });
      if (attempts > 0) throw conflict('This quiz is locked because students have already attempted it');
      if (req.body.lessonId) {
        const lesson = await tx.lesson.findUnique({ where: { id: req.body.lessonId } });
        if (!lesson) throw notFound('Lesson not found');
      }

      const data = {};
      for (const field of ['title', 'status', 'attemptLimit']) {
        if (req.body[field] !== undefined) data[field] = req.body[field];
      }
      if (req.body.lessonId !== undefined) data.lessonId = req.body.lessonId;
      if (req.body.status === 'PUBLISHED' && !existing.publishedAt) data.publishedAt = new Date();
      if (req.body.questions) {
        await tx.question.deleteMany({ where: { quizId: existing.id } });
        data.questions = {
          create: req.body.questions.map((question, questionIndex) => ({
            prompt: question.prompt,
            points: question.points,
            position: questionIndex + 1,
            options: {
              create: question.options.map((option, optionIndex) => ({
                label: option.label,
                isCorrect: option.isCorrect,
                position: optionIndex + 1,
              })),
            },
          })),
        };
      }
      return tx.quiz.update({
        where: { id: existing.id },
        data,
        include: {
          questions: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } },
        },
      });
    }, { isolationLevel: 'Serializable' });
    res.json(publicQuiz(quiz, true));
  } catch (error) {
    if (error.code === 'P2034') {
      next(conflict('The quiz changed while it was being edited. Reload and try again.'));
      return;
    }
    next(error);
  }
});

quizzesRouter.post('/:quizId/attempts', requireRoles('STUDENT'), validate({
  params: z.object({ quizId: z.string().uuid() }),
  body: attemptBody,
}), async (req, res, next) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.quizId },
      include: { questions: { include: { options: true } } },
    });
    if (!quiz || quiz.status !== 'PUBLISHED') {
      next(notFound());
      return;
    }
    const questionIds = new Set(quiz.questions.map((question) => question.id));
    for (const answer of req.body.answers) {
      if (!questionIds.has(answer.questionId)) {
        next(notFound('Answer does not belong to this quiz'));
        return;
      }
      const question = quiz.questions.find((item) => item.id === answer.questionId);
      if (!question.options.some((option) => option.id === answer.optionId)) {
        next(notFound('Answer does not belong to this quiz'));
        return;
      }
    }
    if (req.body.answers.length !== quiz.questions.length) {
      next(new AppError(422, 'VALIDATION_ERROR', 'Request could not be processed', [
        { path: 'answers', message: 'Answer every question' },
      ]));
      return;
    }
    const scored = scoreAttempt(quiz.questions, req.body.answers);
    const attempt = await prisma.$transaction(async (tx) => {
      const used = await tx.quizAttempt.count({ where: { quizId: quiz.id, userId: req.user.id } });
      if (quiz.attemptLimit && used >= quiz.attemptLimit) {
        throw conflict('Attempt limit reached');
      }
      const created = await tx.quizAttempt.create({
        data: {
          userId: req.user.id,
          quizId: quiz.id,
          score: scored.score,
          maxScore: scored.maxScore,
          passed: scored.passed,
          answers: scored.results,
        },
      });
      if (scored.passed) {
        const awarded = await awardPoints(tx, {
          userId: req.user.id,
          amount: scored.score,
          reason: `Quiz passed: ${quiz.title}`,
          sourceType: 'QUIZ',
          sourceId: quiz.id,
          idempotencyKey: `quiz:${quiz.id}:user:${req.user.id}`,
        });
        if (awarded && req.user.notificationsEnabled) {
          await tx.notification.create({
            data: {
              userId: req.user.id,
              type: 'POINTS_AWARDED',
              payload: { amount: scored.score, reason: `Quiz passed: ${quiz.title}` },
            },
          });
        }
        await evaluateBadges(tx, req.user.id);
      }
      return created;
    }, { isolationLevel: 'Serializable' });
    res.status(201).json({
      attemptId: attempt.id,
      score: attempt.score,
      maxScore: attempt.maxScore,
      passed: attempt.passed,
      results: scored.results,
    });
  } catch (error) {
    if (error.code === 'P2034') {
      next(conflict('The quiz changed while your attempt was being submitted. Please try again.'));
      return;
    }
    next(error);
  }
});

quizzesRouter.get('/:quizId/attempts/me', requireRoles('STUDENT'), validate({
  params: z.object({ quizId: z.string().uuid() }),
}), async (req, res, next) => {
  try {
    const quiz = await prisma.quiz.findUnique({ where: { id: req.params.quizId } });
    if (!quiz) {
      next(notFound());
      return;
    }
    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId: quiz.id, userId: req.user.id },
      orderBy: { submittedAt: 'desc' },
      select: { id: true, score: true, maxScore: true, passed: true, submittedAt: true },
    });
    res.json({ items: attempts });
  } catch (error) {
    next(error);
  }
});

export function studentOnly(req, res, next) {
  if (req.user.role !== 'STUDENT') {
    next(forbidden());
    return;
  }
  next();
}
