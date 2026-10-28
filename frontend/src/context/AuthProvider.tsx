import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiClient, ApiError } from '../lib/api.js';
import type { User } from '../types/index.js';
import { AuthContext, type AuthContextValue } from './AuthContext.js';

const TOKEN_STORAGE_KEY = 'apex-motors.token';

/**
 * Owns the session: the token, the current user, and the single ApiClient the
 * rest of the app uses.
 *
 * The token is held in a ref as well as in localStorage, and the API client is
 * given a *getter* rather than the value. That is what lets one client
 * instance survive a login: it reads the current token when a request is
 * actually made, instead of capturing whatever was there when it was built.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const tokenRef = useRef<string | null>(readStoredToken());
  const [user, setUser] = useState<User | null>(null);
  const [initialising, setInitialising] = useState(true);

  const readToken = useCallback(() => tokenRef.current, []);

  const setToken = useCallback((token: string | null) => {
    tokenRef.current = token;

    try {
      if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
      else localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Private browsing can refuse storage; the session still works in memory.
    }
  }, []);

  /*
   * readToken is passed here, never called: the ApiClient invokes it when a
   * request is actually made, long after render. Handing the client a getter
   * is exactly what keeps a single instance valid across a login, so the rule
   * is suppressed deliberately rather than designed around.
   */
  // eslint-disable-next-line react-hooks/refs
  const api = useMemo(() => new ApiClient(readToken), [readToken]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, [setToken]);

  // Restore a session on first load: a stored token is only trustworthy if the
  // server still accepts it, so it is verified rather than assumed.
  useEffect(() => {
    let cancelled = false;

    if (!readToken()) {
      setInitialising(false);
      return;
    }

    api
      .me()
      .then(({ user: restored }) => {
        if (!cancelled) setUser(restored);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.isAuthFailure) logout();
      })
      .finally(() => {
        if (!cancelled) setInitialising(false);
      });

    return () => {
      cancelled = true;
    };
  }, [api, logout, readToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { user: loggedIn, token } = await api.login({ email, password });
      setToken(token);
      setUser(loggedIn);
    },
    [api, setToken],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const { user: created, token } = await api.register({ name, email, password });
      setToken(token);
      setUser(created);
    },
    [api, setToken],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      api,
      initialising,
      isAdmin: user?.role === 'ADMIN',
      login,
      register,
      logout,
    }),
    [user, api, initialising, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}
