// ==================== Rate limiting ====================
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
});

export const scoreLimiter = rateLimit({
  windowMs: 60_000,
  max: config.rateLimit.scoreSubmitPerMin,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many score submissions, please slow down' },
});
