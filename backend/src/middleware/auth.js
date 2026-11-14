import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError, forbidden } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, tv: user.tokenVersion },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN, issuer: 'ecoquest', audience: 'ecoquest-client' },
  );
}

export async function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
    return;
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { issuer: 'ecoquest', audience: 'ecoquest-client' });
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'ACTIVE' || user.tokenVersion !== payload.tv) {
      next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
      return;
    }
    req.user = user;
    next();
  } catch {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      next(forbidden());
      return;
    }
    next();
  };
}
