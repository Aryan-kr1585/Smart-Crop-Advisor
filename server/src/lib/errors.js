export class AppError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(message = 'Resource not found') {
  return new AppError(404, 'NOT_FOUND', message);
}

export function forbidden() {
  return new AppError(403, 'FORBIDDEN', 'You do not have access to this action');
}

export function conflict(message) {
  return new AppError(409, 'CONFLICT', message);
}
