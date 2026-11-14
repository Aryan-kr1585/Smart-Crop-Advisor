import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, conflict } from '../lib/errors.js';
import { publicUser } from '../lib/presenter.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { env } from '../config/env.js';

const credentials = {
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(72),
  displayName: z.string().trim().min(2).max(80),
};

export const authRouter = Router();

function hashResetToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function deliverResetLink(email, resetUrl) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [email],
        subject: 'Reset your EcoQuest password',
        text: `Use this one-time link within 30 minutes to reset your password: ${resetUrl}`,
      }),
    });
    if (!response.ok) console.error(JSON.stringify({ level: 'error', msg: 'password reset email delivery failed', status: response.status }));
  } catch {
    console.error(JSON.stringify({ level: 'error', msg: 'password reset email delivery failed' }));
  }
}

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

authRouter.post('/password-reset-requests', validate({
  body: z.object({ email: credentials.email }),
}), async (req, res, next) => {
  try {
    const genericResponse = { success: true, message: 'If an active account matches that email, a reset link will be sent.' };
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (user?.status === 'ACTIVE') {
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({ where: { OR: [{ userId: user.id }, { expiresAt: { lte: new Date() } }] } }),
        prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt } }),
      ]);
      const resetUrl = `${env.CLIENT_ORIGIN.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
      if (env.NODE_ENV === 'development') genericResponse.developmentResetUrl = resetUrl;
      await deliverResetLink(user.email, resetUrl);
    }
    res.json(genericResponse);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/password-resets', validate({
  body: z.object({
    token: z.string().min(32).max(128),
    password: credentials.password,
  }),
}), async (req, res, next) => {
  try {
    const tokenHash = hashResetToken(req.body.token);
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const reset = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
      if (!reset || reset.usedAt || reset.expiresAt <= now) return false;
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: reset.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) return false;
      await tx.user.update({ where: { id: reset.userId }, data: { passwordHash, tokenVersion: { increment: 1 } } });
      await tx.passwordResetToken.deleteMany({ where: { userId: reset.userId, id: { not: reset.id } } });
      return true;
    });
    if (!result) {
      next(new AppError(400, 'INVALID_RESET_TOKEN', 'This reset link is invalid or expired. Request a new one.'));
      return;
    }
    res.json({ success: true, message: 'Password updated. Please log in with your new password.' });
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
