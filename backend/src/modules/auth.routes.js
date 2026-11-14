import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, conflict } from '../lib/errors.js';
import { publicUser } from '../lib/presenter.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const credentials = {
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(72),
  displayName: z.string().trim().min(2).max(80),
};

export const authRouter = Router();

authRouter.post('/register', validate({
  body: z.object({
    email: credentials.email,
    password: credentials.password,
    displayName: credentials.displayName,
  }),
}), async (req, res, next) => {
  try {
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const user = await prisma.user.create({
      data: {
        email: req.body.email,
        passwordHash,
        displayName: req.body.displayName,
        role: 'STUDENT',
      },
    });
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 'P2002') {
      next(conflict('An account with this email already exists'));
      return;
    }
    next(error);
  }
});

authRouter.post('/login', validate({
  body: z.object({
    email: credentials.email,
    password: z.string().min(1).max(72),
  }),
}), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    const matches = user ? await bcrypt.compare(req.body.password, user.passwordHash) : false;
    if (!user || !matches || user.status !== 'ACTIVE') {
      next(new AppError(401, 'UNAUTHENTICATED', 'Invalid email or password'));
      return;
    }
    const accessToken = signToken(user);
    res.json({ accessToken, expiresIn: process.env.JWT_EXPIRES_IN || '12h', user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { tokenVersion: { increment: 1 } },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
