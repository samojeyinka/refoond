import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import { AppError, errorCodes } from '../utils/errors';

function limiterMessage(label: string) {
  return (_req: Request, _res: Response, _next: NextFunction): void => {
    throw new AppError(429, `Too many requests. ${label}`, errorCodes.RATE_LIMITED);
  };
}

export const globalRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limiterMessage('Please slow down.'),
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limiterMessage('Too many authentication attempts. Try again later.'),
});

export const aiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limiterMessage('AI requests are rate limited.'),
});

export const widgetRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limiterMessage('widget requests are rate limited.'),
});
