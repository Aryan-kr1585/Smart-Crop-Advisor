import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { cloudinaryConfigured } from '../config/env.js';
import { authRouter } from '../modules/auth.routes.js';
import { usersRouter } from '../modules/users.routes.js';
import { schoolsRouter } from '../modules/schools.routes.js';
import { lessonsRouter } from '../modules/lessons.routes.js';
import { quizzesRouter } from '../modules/quizzes.routes.js';
import { submissionsRouter, tasksRouter } from '../modules/tasks.routes.js';
import { badgesRouter, challengesRouter, leaderboardRouter, notificationsRouter } from '../modules/engage.routes.js';
import { uploadsRouter } from '../modules/uploads.routes.js';

export const api = Router();

api.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'up',
      uploads: cloudinaryConfigured() ? 'cloudinary' : 'local',
    });
  } catch {
    res.status(503).json({
      error: { code: 'UNAVAILABLE', message: 'Database unavailable', details: [] },
    });
  }
});

api.use('/auth', authRouter);
api.use('/users', usersRouter);
api.use(schoolsRouter);
api.use('/lessons', lessonsRouter);
api.use('/quizzes', quizzesRouter);
api.use('/tasks', tasksRouter);
api.use('/submissions', submissionsRouter);
api.use('/badges', badgesRouter);
api.use('/challenges', challengesRouter);
api.use('/leaderboard', leaderboardRouter);
api.use('/notifications', notificationsRouter);
api.use('/uploads', uploadsRouter);
