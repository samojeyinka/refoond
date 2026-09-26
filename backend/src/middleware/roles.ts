import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../constants';
import { AppError, errorCodes } from '../utils/errors';
import type { AuthedRequest } from '../types/request';

export function requireRole(...roles: Role[]): (req: Request, res: Response, next: NextFunction) => void {
  return (req, _res, next) => {
    const authed = req as AuthedRequest;
    if (!authed.user) {
      next(new AppError(401, 'Authentication required', errorCodes.UNAUTHORIZED));
      return;
    }
    if (!roles.includes(authed.user.role)) {
      next(new AppError(403, 'This action is restricted to support staff', errorCodes.FORBIDDEN));
      return;
    }
    next();
  };
}
