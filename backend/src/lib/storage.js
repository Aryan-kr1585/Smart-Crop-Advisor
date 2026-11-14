import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { cloudinaryConfigured, env } from '../config/env.js';

export async function removeStoredAsset(asset) {
  if (asset.provider === 'local') {
    const root = path.resolve(process.cwd(), 'uploads');
    const filePath = path.join(root, path.basename(asset.storageKey));
    await fs.rm(filePath, { force: true });
    return;
  }
  if (asset.provider === 'cloudinary' && cloudinaryConfigured()) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    });
    const result = await cloudinary.uploader.destroy(asset.storageKey, { invalidate: true });
    if (result.result !== 'ok' && result.result !== 'not found') throw new Error('Evidence removal was not confirmed');
    return;
  }
  throw new Error('Unsupported evidence storage provider');
}
