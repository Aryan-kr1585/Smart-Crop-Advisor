import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { api } from './routes/api.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin: env.CLIENT_ORIGIN,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      console.log(JSON.stringify({
        level: 'info',
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - started,
      }));
    });
    next();
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.', details: [] } },
  });
  app.use('/api/v1/auth/login', authLimiter);
  app.use('/api/v1/auth/register', authLimiter);
  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
