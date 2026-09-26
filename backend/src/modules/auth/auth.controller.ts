import type { Request, Response } from 'express';
import { z } from 'zod';
import { SessionModel } from '../../models/session.model';
import { ok } from '../../utils/http';
import { verifyToken } from '../../middleware/auth';
import type { AuthedRequest } from '../../types/request';
import { loginUser, respondLoggedOut, signupUser } from './auth.service';

export const signupSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8).max(128),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1).max(128),
  }),
});

export async function signup(req: Request, res: Response): Promise<void> {
  const { fullName, email, password } = req.body as { fullName: string; email: string; password: string };
  const result = await signupUser(res, {
    fullName,
    email,
    password,
    userAgent: req.get('user-agent'),
    ip: req.ip,
  });
  ok(res, result, 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
  const result = await loginUser(res, { email, password, userAgent: req.get('user-agent'), ip: req.ip });
  ok(res, result);
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const authed = req as AuthedRequest;
  ok(res, { user: authed.user });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.wn_token as string | undefined;
  if (token) {
    try {
      const payload = verifyToken(token);
      await SessionModel.findOneAndUpdate({ tokenHash: payload.sid }, { active: false }).exec();
    } catch {
      // An invalid or expired cookie still results in a successful logout.
    }
  }
  respondLoggedOut(res);
  ok(res, { loggedOut: true });
}
