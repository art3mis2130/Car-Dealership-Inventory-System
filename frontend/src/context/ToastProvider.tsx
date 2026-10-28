import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ToastContext, type ToastContextValue, type ToastTone } from './ToastContext.js';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

const TONE_STYLES: Record<ToastTone, string> = {
  success: 'border-success-500/40 bg-success-500/10 text-success-300',
  error: 'border-danger-500/40 bg-danger-500/10 text-danger-300',
  info: 'border-info-400/40 bg-info-400/10 text-info-400',
};

const TONE_ICONS: Record<ToastTone, string> = {
  success: 'M5 13l4 4L19 7',
  error:
    'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

const DISMISS_AFTER_MS = 5000;

/**
 * Lightweight toast notifications.
 *
 * Feedback for an action - bought a car, restocked, failed - belongs where the
 * user is already looking, and a single provider means no component has to own
 * its own alert state. The live region is polite rather than assertive so a
 * screen reader finishes the current sentence before announcing it.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), DISMISS_AFTER_MS);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-fade-up pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lift backdrop-blur-md ${TONE_STYLES[toast.tone]}`}
          >
            <svg
              className="mt-0.5 h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={TONE_ICONS[toast.tone]} />
            </svg>

            <p className="flex-1">{toast.message}</p>

            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 text-ink-300 transition hover:text-ink-100"
              aria-label="Dismiss notification"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
