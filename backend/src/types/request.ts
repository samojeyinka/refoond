import type { Request } from 'express';
import type { Role } from '../constants';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

export interface AuthedRequest extends Request {
  user: AuthUser;
}

export type AuthedReq = AuthedRequest;
