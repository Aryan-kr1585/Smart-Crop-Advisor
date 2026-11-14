import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../lib/errors.js';
import { cursorWhere, pageResult } from '../lib/pagination.js';
import { writeAudit } from '../lib/progress.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const page = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

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

schoolsRouter.post('/classes/:classId/members', requireRoles('ADMIN', 'TEACHER'), validate({
  params: z.object({ classId: z.string().uuid() }),
  body: z.object({ userIds: z.array(z.string().uuid()).min(1).max(50) }),
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
    await prisma.$transaction(async (tx) => {
      for (const user of users) {
        if (!user.schoolId) {
          await tx.user.update({ where: { id: user.id }, data: { schoolId: cls.schoolId } });
        }
        await tx.classMembership.upsert({
          where: { userId_classId: { userId: user.id, classId: cls.id } },
          update: { status: 'ACTIVE' },
          create: { userId: user.id, classId: cls.id },
        });
      }
      await writeAudit(tx, {
        actorId: req.user.id,
        action: 'CLASS_MEMBERS_ADD',
        entityType: 'Class',
        entityId: cls.id,
        metadata: { userIds: req.body.userIds },
      });
    });
    res.json({ added: users.length });
  } catch (error) {
    next(error);
  }
});
