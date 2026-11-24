import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

export const ACTIVITY_IDS = ['sort-the-garden', 'cleanup-rush', 'learning-garden-agent', 'garden-explorer'];
export const activitiesRouter = Router();
activitiesRouter.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
}), requireAuth, requireRoles('STUDENT'));

activitiesRouter.get('/progress', async (req, res, next) => {
  try {
    const items = await prisma.activityCompletion.findMany({
      where: { userId: req.user.id },
      select: { activityId: true, completedAt: true },
    });
    res.json({ items });
  } catch (error) { next(error); }
});

activitiesRouter.post('/:activityId/completion', validate({
  params: z.object({ activityId: z.enum(ACTIVITY_IDS) }),
}), async (req, res, next) => {
  try {
    const item = await prisma.activityCompletion.upsert({
      where: { userId_activityId: { userId: req.user.id, activityId: req.params.activityId } },
      create: { userId: req.user.id, activityId: req.params.activityId },
      update: {},
      select: { activityId: true, completedAt: true },
    });
    res.status(200).json(item);
  } catch (error) { next(error); }
});
