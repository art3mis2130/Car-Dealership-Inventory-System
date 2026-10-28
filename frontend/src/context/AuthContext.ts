import { createContext } from 'react';
import type { ApiClient } from '../lib/api.js';
import type { User } from '../types/index.js';

export interface AuthContextValue {
  user: User | null;
  api: ApiClient;
  /** True until the stored token has been checked, so routes do not flash. */
  initialising: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

/**
 * The context lives in its own module, apart from both the provider component
 * and the hook. That split is what lets React Fast Refresh replace the
 * provider during development without tearing down the session.
 */
export const AuthContext = createContext<AuthContextValue | null>(null);
