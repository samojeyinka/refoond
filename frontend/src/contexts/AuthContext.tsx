import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import { ApiError } from '../api/client';
import type { AuthUser } from '../api/types';

interface AuthContextValue {
  me: AuthUser | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  login: (input: authApi.LoginInput) => Promise<void>;
  signup: (input: authApi.SignupInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.me();
      setMe(response.user);
    } catch (caught) {
      setMe(null);
      if (!(caught instanceof ApiError && caught.status === 401)) {
        setError(caught instanceof Error ? caught.message : 'Could not load your session');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (input: authApi.LoginInput) => {
      await authApi.login(input);
      await refresh();
    },
    [refresh],
  );

  const signup = useCallback(
    async (input: authApi.SignupInput) => {
      await authApi.signup(input);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setMe(null);
    }
  }, []);

  const value = useMemo(
    () => ({ me, loading, error, isAdmin: me?.role === 'ADMIN', refresh, login, signup, logout }),
    [me, loading, error, refresh, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
