import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '../context/AuthContext.js';

/**
 * Reads the current session.
 *
 * Throws rather than returning null, so a component that forgets the provider
 * fails loudly instead of quietly rendering as though nobody is signed in.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }

  return context;
}
