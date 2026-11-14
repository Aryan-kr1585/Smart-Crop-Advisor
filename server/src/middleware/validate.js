import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

export function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new AppError(422, 'VALIDATION_ERROR', 'Request could not be processed', error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }))));
        return;
      }
      next(error);
    }
  };
}
