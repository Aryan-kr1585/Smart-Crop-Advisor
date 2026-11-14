import { AppError } from '../lib/errors.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Resource not found', details: [] },
  });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed JSON', details: [] } });
    return;
  }
  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request is too large', details: [] } });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }
  console.error(JSON.stringify({
    level: 'error',
    msg: 'unhandled error',
    name: err.name,
    message: env.NODE_ENV === 'production' ? 'unexpected' : err.message,
  }));
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong', details: [] },
  });
}
