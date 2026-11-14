import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { v2 as cloudinary } from 'cloudinary';
import { cloudinaryConfigured, env } from '../config/env.js';
import { AppError, notFound } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const uploadRoot = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(uploadRoot, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

function sniff(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

function extension(mime) {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  return 'webp';
}

async function canView(user, ownerId) {
  if (user.id === ownerId || user.role === 'ADMIN') return true;
  if (user.role !== 'TEACHER') return false;
  const shared = await prisma.classMembership.findFirst({
    where: {
      userId: ownerId,
      status: 'ACTIVE',
      class: { memberships: { some: { userId: user.id, status: 'ACTIVE' } } },
    },
  });
  return Boolean(shared);
}

export const uploadsRouter = Router();
uploadsRouter.use(requireAuth);

uploadsRouter.get('/config', (req, res) => {
  res.json({ provider: cloudinaryConfigured() ? 'cloudinary' : 'local', maxBytes: 5 * 1024 * 1024 });
});

uploadsRouter.post('/signature', requireRoles('STUDENT'), validate({
  body: z.object({
    fileName: z.string().trim().min(1).max(180),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    size: z.number().int().positive().max(5 * 1024 * 1024),
  }),
}), (req, res, next) => {
  if (!cloudinaryConfigured()) {
    next(new AppError(422, 'VALIDATION_ERROR', 'Cloud image hosting is not configured. Use the local upload instead.', []));
    return;
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  const timestamp = Math.round(Date.now() / 1000);
  const folder = 'ecoquest';
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, env.CLOUDINARY_API_SECRET);
  res.json({
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    folder,
    signature,
  });
});

uploadsRouter.post('/local', requireRoles('STUDENT'), (req, res, next) => {
  upload.single('file')(req, res, async (error) => {
    try {
      if (error) {
        next(new AppError(422, 'VALIDATION_ERROR', 'Request could not be processed', [
          { path: 'file', message: 'Use a JPEG, PNG, or WebP image up to 5 MB' },
        ]));
        return;
      }
      if (!req.file) {
        next(new AppError(422, 'VALIDATION_ERROR', 'Request could not be processed', [
          { path: 'file', message: 'Choose an image' },
        ]));
        return;
      }
      const mimeType = sniff(req.file.buffer);
      if (!mimeType) {
        next(new AppError(422, 'VALIDATION_ERROR', 'Request could not be processed', [
          { path: 'file', message: 'File content must be JPEG, PNG, or WebP' },
        ]));
        return;
      }
      const asset = await prisma.uploadAsset.create({
        data: {
          userId: req.user.id,
          provider: 'local',
          storageKey: 'pending',
          mimeType,
          size: req.file.buffer.length,
        },
      });
      const storageKey = `${asset.id}.${extension(mimeType)}`;
      await fs.promises.writeFile(path.join(uploadRoot, storageKey), req.file.buffer);
      const saved = await prisma.uploadAsset.update({
        where: { id: asset.id },
        data: { storageKey },
      });
      res.status(201).json({ assetId: saved.id, mimeType: saved.mimeType, size: saved.size });
    } catch (uploadError) {
      next(uploadError);
    }
  });
});

uploadsRouter.get('/:assetId', validate({
  params: z.object({ assetId: z.string().uuid() }),
}), async (req, res, next) => {
  try {
    const asset = await prisma.uploadAsset.findUnique({ where: { id: req.params.assetId } });
    if (!asset || !(await canView(req.user, asset.userId))) {
      next(notFound());
      return;
    }
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (asset.provider === 'local') {
      const filePath = path.join(uploadRoot, path.basename(asset.storageKey));
      if (!fs.existsSync(filePath)) {
        next(notFound());
        return;
      }
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    });
    const url = cloudinary.url(asset.storageKey, { secure: true });
    const response = await fetch(url);
    if (!response.ok) {
      next(notFound());
      return;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    res.send(bytes);
  } catch (error) {
    next(error);
  }
});
