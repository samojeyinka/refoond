import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError, errorCodes } from '../utils/errors';
import { UserModel } from '../models/user.model';
import { SessionModel } from '../models/session.model';
import type { AuthedRequest } from '../types/request';

export function signToken(payload: object): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token: string): { sub: string; sid: string; w: string } {
  const decoded = jwt.verify(token, env.jwtSecret);
  if (typeof decoded === 'string' || typeof decoded.sub !== 'string' || typeof decoded.sid !== 'string') {
    throw new AppError(401, 'Invalid session', errorCodes.UNAUTHORIZED);
  }
  return { sub: decoded.sub, sid: decoded.sid, w: typeof decoded.w === 'string' ? decoded.w : '' };
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie('wn_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    maxAge: env.cookieMaxAge * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie('wn_token', { httpOnly: true, sameSite: 'lax', secure: env.cookieSecure, path: '/' });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.wn_token as string | undefined;
    if (!token) {
      throw new AppError(401, 'Authentication required', errorCodes.UNAUTHORIZED);
    }

    let payload: ReturnType<typeof verifyToken>;
    try {
      payload = verifyToken(token);
    } catch {
      throw new AppError(401, 'Your session has expired. Please sign in again.', errorCodes.UNAUTHORIZED);
    }

    const [user, session] = await Promise.all([
      UserModel.findById(payload.sub).lean(),
      SessionModel.findOne({ _id: payload.sid, active: true, userId: payload.sub }).lean(),
    ]);

    if (!user || !session) {
      throw new AppError(401, 'Your session is no longer valid', errorCodes.UNAUTHORIZED);
    }

    SessionModel.updateOne({ _id: session._id }, { lastActiveAt: new Date() }).exec();

    const authed = req as AuthedRequest;
    authed.user = {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (err) {
    next(err);
  }
}