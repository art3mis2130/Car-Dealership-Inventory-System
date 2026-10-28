import { createContext } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastContextValue {
  notify: (message: string, tone?: ToastTone) => void;
}

/** Kept apart from the provider component, as with AuthContext. */
export const ToastContext = createContext<ToastContextValue | null>(null);
