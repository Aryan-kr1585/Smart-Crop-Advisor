import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, conflict, notFound } from '../lib/errors.js';
import { cursorWhere, pageResult } from '../lib/pagination.js';
import { writeAudit } from '../lib/progress.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const page = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

function decodeProgressCursor(cursor) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (!Number.isInteger(value.points) || typeof value.displayName !== 'string' || typeof value.id !== 'string') return null;
    return value;
  } catch {
    return null;
  }
}

function compareProgress(a, b) {
  return b.points - a.points || a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id);
}

export const schoolsRouter = Router();
schoolsRouter.use(requireAuth);

schoolsRouter.get('/schools', validate({ query: page }), async (req, res, next) => {
  try {
    const where = { ...cursorWhere(req.query.cursor) };
    if (req.user.role !== 'ADMIN') {
      if (!req.user.schoolId) {
        res.json({ items: [], nextCursor: null });
        return;
      }
      where.id = req.user.schoolId;
    }
    const rows = await prisma.school.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: req.query.limit + 1,
    });
    const result = pageResult(rows, req.query.limit);
    res.json({
      items: result.items.map((school) => ({
        id: school.id,
        name: school.name,
        region: school.region,
        status: school.status,
      })),
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    next(error);
  }
});

schoolsRouter.post('/schools', requireRoles('ADMIN'), validate({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    region: z.string().trim().max(80).optional(),
  }),
}), async (req, res, next) => {
  try {
    const school = await prisma.$transaction(async (tx) => {
      const created = await tx.school.create({ data: { name: req.body.name, region: req.body.region } });
      await writeAudit(tx, {
        actorId: req.user.id,
        action: 'SCHOOL_CREATE',
        entityType: 'School',
        entityId: created.id,
        metadata: { name: created.name },
      });
      return created;
    });
    res.status(201).json({ id: school.id, name: school.name, region: school.region, status: school.status });
  } catch (error) {
    if (error.code === 'P2002') {
      next(conflict('A school with this name already exists'));
      return;
    }
    next(error);
  }
});

schoolsRouter.patch('/schools/:schoolId', requireRoles('ADMIN'), validate({
  params: z.object({ schoolId: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(2).max(120).optional(),
    region: z.string().trim().max(80).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  }),
}), async (req, res, next) => {
  try {
    const school = await prisma.school.update({ where: { id: req.params.schoolId }, data: req.body });
    res.json({ id: school.id, name: school.name, region: school.region, status: school.status });
  } catch (error) {
    if (error.code === 'P2025') {
      next(notFound());
      return;
    }
    if (error.code === 'P2002') {
      next(conflict('A school with this name already exists'));
      return;
    }
    next(error);
  }
});

schoolsRouter.get('/schools/:schoolId/classes', requireRoles('ADMIN', 'TEACHER'), validate({
  params: z.object({ schoolId: z.string().uuid() }),
  query: page,
}), async (req, res, next) => {
  try {
    if (req.user.role === 'TEACHER' && req.user.schoolId !== req.params.schoolId) {
      next(notFound());
      return;
    }
    const where = { schoolId: req.params.schoolId, ...cursorWhere(req.query.cursor) };
    if (req.user.role === 'TEACHER') {
      where.memberships = { some: { userId: req.user.id, status: 'ACTIVE' } };
    }
    const rows = await prisma.class.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: req.query.limit + 1,
    });
    const result = pageResult(rows, req.query.limit);
    res.json({
      items: result.items.map((item) => ({
        id: item.id,
        name: item.name,
        academicYear: item.academicYear,
        schoolId: item.schoolId,
      })),
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    next(error);
  }
});

schoolsRouter.get('/classes/:classId/progress', requireRoles('ADMIN', 'TEACHER'), validate({
  params: z.object({ classId: z.string().uuid() }),
  query: page,
}), async (req, res, next) => {
  try {
    const cls = await prisma.class.findUnique({ where: { id: req.params.classId }, select: { id: true } });
    if (!cls) {
      next(notFound());
      return;
    }
    if (req.user.role === 'TEACHER') {
      const assigned = await prisma.classMembership.findFirst({
        where: { classId: cls.id, userId: req.user.id, status: 'ACTIVE' },
        select: { userId: true },
      });
      if (!assigned) {
        next(notFound());
        return;
      }
    }
    const memberships = await prisma.classMembership.findMany({
      where: { classId: cls.id, status: 'ACTIVE', user: { role: 'STUDENT', status: 'ACTIVE' } },
      select: { user: { select: { id: true, displayName: true } } },
    });
    const userIds = memberships.map((membership) => membership.user.id);
    const totals = await prisma.pointLedger.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _sum: { amount: true },
    });
    const totalByUser = new Map(totals.map((row) => [row.userId, row._sum.amount ?? 0]));
    const ranked = memberships.map(({ user }) => ({
      id: user.id,
      displayName: user.displayName,
      points: totalByUser.get(user.id) ?? 0,
    })).sort(compareProgress);
    const cursor = decodeProgressCursor(req.query.cursor);
    if (req.query.cursor && !cursor) {
      next(new AppError(422, 'VALIDATION_ERROR', 'Request could not be processed', [
        { path: 'cursor', message: 'Cursor is invalid' },
      ]));
      return;
    }
    const cursorIndex = cursor ? ranked.findIndex((row) => compareProgress(row, cursor) > 0) : 0;
    const start = cursorIndex < 0 ? ranked.length : cursorIndex;
    const rows = ranked.slice(start, start + req.query.limit + 1);
    const hasMore = rows.length > req.query.limit;
    const items = hasMore ? rows.slice(0, req.query.limit) : rows;
    const last = items[items.length - 1];
    res.json({
      items: items.map((row, index) => ({ rank: start + index + 1, userId: row.id, displayName: row.displayName, points: row.points })),
      nextCursor: hasMore && last
        ? Buffer.from(JSON.stringify(last)).toString('base64url')
        : null,
    });
  } catch (error) {
    next(error);
  }
});

schoolsRouter.post('/schools/:schoolId/classes', requireRoles('ADMIN'), validate({
  params: z.object({ schoolId: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(1).max(80),
    academicYear: z.string().trim().max(20).optional(),
  }),
}), async (req, res, next) => {
  try {
    const school = await prisma.school.findUnique({ where: { id: req.params.schoolId } });
    if (!school) {
      next(notFound('School not found'));
      return;
    }
    const created = await prisma.class.create({
      data: {
        schoolId: school.id,
        name: req.body.name,
        academicYear: req.body.academicYear,
      },
    });
    res.status(201).json({
      id: created.id,
      name: created.name,
      academicYear: created.academicYear,
      schoolId: created.schoolId,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      next(conflict('This class already exists for the academic year'));
      return;
    }
    next(error);
  }
});

schoolsRouter.patch('/classes/:classId', requireRoles('ADMIN'), validate({
  params: z.object({ classId: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(1).max(80).optional(),
    academicYear: z.string().trim().max(20).nullable().optional(),
  }).refine((body) => Object.keys(body).length > 0, { message: 'No changes provided' }),
}), async (req, res, next) => {
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const cls = await tx.class.update({ where: { id: req.params.classId }, data: req.body });
      await writeAudit(tx, {
        actorId: req.user.id,
        action: 'CLASS_UPDATE',
        entityType: 'Class',
        entityId: cls.id,
        metadata: { changedFields: Object.keys(req.body) },
      });
      return cls;
    });
    res.json({ id: updated.id, name: updated.name, academicYear: updated.academicYear, schoolId: updated.schoolId });
  } catch (error) {
    if (error.code === 'P2025') {
      next(notFound());
      return;
    }
    if (error.code === 'P2002') {
      next(conflict('This class already exists for the academic year'));
      return;
    }
    next(error);
  }
});

schoolsRouter.post('/classes/:classId/members', requireRoles('ADMIN', 'TEACHER'), validate({
  params: z.object({ classId: z.string().uuid() }),
  body: z.object({ userIds: z.array(z.string().uuid()).min(1).max(50) }).refine(
    (body) => new Set(body.userIds).size === body.userIds.length,
    { path: ['userIds'], message: 'A person can only be listed once' },
  ),
}), async (req, res, next) => {
  try {
    const cls = await prisma.class.findUnique({ where: { id: req.params.classId } });
    if (!cls) {
      next(notFound());
      return;
    }
    if (req.user.role === 'TEACHER') {
      const membership = await prisma.classMembership.findFirst({
        where: { classId: cls.id, userId: req.user.id, status: 'ACTIVE' },
      });
      if (!membership) {
        next(notFound());
        return;
      }
    }
    const users = await prisma.user.findMany({ where: { id: { in: req.body.userIds } } });
    if (users.length !== req.body.userIds.length) {
      next(notFound('One or more users were not found'));
      return;
    }
    for (const user of users) {
      if (user.schoolId && user.schoolId !== cls.schoolId) {
        next(conflict(`${user.displayName} belongs to another school`));
        return;
      }
    }
    const result = await prisma.$transaction(async (tx) => {
      const existingMemberships = await tx.classMembership.findMany({
        where: { classId: cls.id, userId: { in: users.map((user) => user.id) } },
      });
      const membershipByUser = new Map(existingMemberships.map((membership) => [membership.userId, membership]));
      const alreadyMembers = users.filter((user) => membershipByUser.get(user.id)?.status === 'ACTIVE').length;
      const toAdd = users.filter((user) => membershipByUser.get(user.id)?.status !== 'ACTIVE');
      for (const user of users) {
        if (membershipByUser.get(user.id)?.status === 'ACTIVE') continue;
        if (!user.schoolId) {
          await tx.user.update({ where: { id: user.id }, data: { schoolId: cls.schoolId } });
        }
        await tx.classMembership.upsert({
          where: { userId_classId: { userId: user.id, classId: cls.id } },
          update: { status: 'ACTIVE' },
          create: { userId: user.id, classId: cls.id },
        });
      }
      if (toAdd.length) {
        await writeAudit(tx, {
          actorId: req.user.id,
          action: 'CLASS_MEMBERS_ADD',
          entityType: 'Class',
          entityId: cls.id,
          metadata: { userIds: toAdd.map((user) => user.id) },
        });
      }
      return { added: toAdd.length, alreadyMembers };
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

schoolsRouter.delete('/classes/:classId/members/:userId', requireRoles('ADMIN'), validate({
  params: z.object({ classId: z.string().uuid(), userId: z.string().uuid() }),
}), async (req, res, next) => {
  try {
    await prisma.$transaction(async (tx) => {
      const membership = await tx.classMembership.findUnique({
        where: { userId_classId: { userId: req.params.userId, classId: req.params.classId } },
      });
      if (!membership || membership.status !== 'ACTIVE') throw notFound('Active class membership not found');
      await tx.classMembership.update({
        where: { userId_classId: { userId: req.params.userId, classId: req.params.classId } },
        data: { status: 'INACTIVE' },
      });
      await writeAudit(tx, {
        actorId: req.user.id,
        action: 'CLASS_MEMBER_REMOVE',
        entityType: 'Class',
        entityId: req.params.classId,
        metadata: { userId: req.params.userId },
      });
    });
    res.json({ removed: true });
  } catch (error) {
    next(error);
  }
});
