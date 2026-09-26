import { apiRequest } from './client';
import type { AuthUser } from './types';

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignupInput extends LoginInput {
  fullName: string;
}

export function login(input: LoginInput): Promise<{ user: AuthUser }> {
  return apiRequest<{ user: AuthUser }>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function signup(input: SignupInput): Promise<{ user: AuthUser }> {
  return apiRequest<{ user: AuthUser }>('/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function logout(): Promise<{ loggedOut: boolean }> {
  return apiRequest<{ loggedOut: boolean }>('/api/v1/auth/logout', { method: 'POST' });
}

export function me(): Promise<{ user: AuthUser }> {
  return apiRequest<{ user: AuthUser }>('/api/v1/auth/me');
}
