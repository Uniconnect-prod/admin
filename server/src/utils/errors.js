/**
 * Application error carrying an HTTP status, a stable machine-readable code and an
 * optional safe-to-display detail object. Anything not wrapped in AppError is treated
 * as an internal error and its message is never sent to the browser.
 */
export class AppError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details, code = 'VALIDATION_ERROR') => new AppError(400, code, message, details);
export const notFound = (message, code = 'NOT_FOUND') => new AppError(404, code, message);
export const forbidden = (message, code = 'FORBIDDEN') => new AppError(403, code, message);
export const conflict = (message, code = 'CONFLICT', details) => new AppError(409, code, message, details);

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function exactCaseInsensitive(value) {
  return new RegExp(`^${escapeRegex(String(value).trim())}$`, 'i');
}
