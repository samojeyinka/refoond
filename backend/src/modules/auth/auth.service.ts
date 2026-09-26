import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import type { Response } from 'express';
import type { Role } from '../../constants';
import { UserModel } from '../../models/user.model';
import { SessionModel } from '../../models/session.model';
import { AppError, errorCodes } from '../../utils/errors';
import { clearAuthCookie, setAuthCookie, signToken } from '../../middleware/auth';

export interface AuthUserDto {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

export interface AuthResult {
  user: AuthUserDto;
}

export async function createSessionForUser(
  res: Response,
  payload: { userId: string; userAgent?: string; ip?: string },
): Promise<void> {
  const sid = nanoid();
  const token = signToken({ sub: payload.userId, sid });
  setAuthCookie(res, token);
  await SessionModel.create({
    _id: sid,
    userId: payload.userId,
    tokenHash: sid,
    userAgent: payload.userAgent ?? '',
    ip: payload.ip ?? '',
  });
}

export async function signupUser(
  res: Response,
  input: { fullName: string; email: string; password: string; userAgent?: string; ip?: string },
): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim();
  const existing = await UserModel.findOne({ email }).lean();
  if (existing) {
    throw new AppError(409, 'An account with this email already exists', 'EMAIL_IN_USE');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await UserModel.create({
    fullName: input.fullName.trim(),
    email,
    passwordHash,
    role: 'CUSTOMER',
  });

  await createSessionForUser(res, {
    userId: user._id.toString(),
    userAgent: input.userAgent,
    ip: input.ip,
  });

  return { user: { id: user._id.toString(), fullName: user.fullName, email: user.email, role: user.role } };
}

export async function loginUser(
  res: Response,
  input: { email: string; password: string; userAgent?: string; ip?: string },
): Promise<AuthResult> {
  const user = await UserModel.findOne({ email: input.email.toLowerCase().trim() });
  if (!user) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  await createSessionForUser(res, {
    userId: user._id.toString(),
    userAgent: input.userAgent,
    ip: input.ip,
  });

  return { user: { id: user._id.toString(), fullName: user.fullName, email: user.email, role: user.role } };
}

export function respondLoggedOut(res: Response): void {
  clearAuthCookie(res);
}
