// ==================== Error handling middleware ====================
import { ZodError } from 'zod';
import { logger } from '../logger.js';

export function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.flatten() });
  }
  const status = err.status || 500;
  // err.expose marks an operational error whose message is safe to return even
  // for 5xx (e.g. a deliberate 503 when on-chain validation is misconfigured).
  const showMessage = status < 500 || err.expose;

  if (status >= 500 && !err.expose) {
    logger.error({ err: err.message, stack: err.stack }, 'unhandled error');
  } else if (status >= 500) {
    logger.warn({ err: err.message }, 'operational error');
  }

  res.status(status).json({
    error: showMessage ? err.message : 'Internal server error',
    ...(err.details ? { details: err.details } : {}),
  });
}
