import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().min(1).default('12h'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  MAIL_FROM: z.union([z.literal(''), z.string().min(3)]).default(''),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production' && (!value.RESEND_API_KEY || !value.MAIL_FROM)) {
    ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'Password recovery email requires RESEND_API_KEY and MAIL_FROM in production' });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  console.error(JSON.stringify({ level: 'error', msg: 'invalid environment', details }));
  process.exit(1);
}

export const env = parsed.data;

export function cloudinaryConfigured() {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}
