import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

/**
 * Gate for the signed-in part of the app.
 *
 * While the stored token is being checked it renders a placeholder rather
 * than redirecting, so a refresh does not bounce an authenticated user to the
 * login screen. The attempted path is remembered so they land where they were
 * going after signing in.
 */
export function ProtectedRoute() {
  const { user, initialising } = useAuth();
  const location = useLocation();

  if (initialising) {
    return (
      <div className="grid min-h-[60vh] place-items-center" role="status" aria-label="Loading">
        <div className="flex flex-col items-center gap-3 text-ink-400">
          <svg className="h-7 w-7 animate-spin text-brand-400" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-85"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"
            />
          </svg>
          <p className="text-sm">Restoring your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
