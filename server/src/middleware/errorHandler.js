import { IntegrationError } from '../integrations/errors.js';
import { AppError } from '../utils/errors.js';

/**
 * Central error handler. Integration failures are returned with a stable code and a
 * user-friendly message so the dashboard can never mistake a failure for an empty report.
 * Unexpected errors are logged server-side and returned as a generic 500.
 */
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (res.headersSent) return;
  if (err?.name === 'AbortError') {
    // Client went away; nothing to send.
    return;
  }
  if (err instanceof IntegrationError) {
    if (err.httpStatus >= 500 || err.code === 'SECRET_KEY_MISSING') {
      console.warn(`[Integration] ${req.method} ${req.originalUrl} → ${err.code}: ${err.message}`);
    }
    if (err.retryAfterSeconds) res.setHeader('Retry-After', String(err.retryAfterSeconds));
    return res.status(err.httpStatus).json({ success: false, ...err.toJSON(), source: 'platform_api' });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ success: false, code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, code: 'INVALID_JSON_BODY', message: 'Request body is not valid JSON.' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' });
  }
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);
  return res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Something went wrong on the server. The error has been logged.' });
}
