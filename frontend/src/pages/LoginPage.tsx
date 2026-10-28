import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { ApiError } from '../lib/api.js';
import { Button } from '../components/ui/Button.js';
import { TextField } from '../components/ui/Field.js';
import { AuthLayout } from './AuthLayout.js';

/** Sign-in screen. Also offers the seeded demo accounts as one-click fills. */
export function LoginPage() {
  const { login, user, initialising } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!initialising && user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login(email, password);
      navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true });
    } catch (cause: unknown) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Could not reach the server. Is the API running?',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError(null);
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to browse the lot and manage your purchases."
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />

        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="........"
          required
        />

        {error ? (
          <p
            className="rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2.5 text-sm text-danger-300"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" loading={submitting} fullWidth size="lg">
          Sign in
        </Button>
      </form>

      <div className="mt-6 rounded-xl border border-ink-700/70 bg-ink-850/60 p-4">
        <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-ink-400">
          Demo accounts (from npm run seed)
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fillDemo('admin@dealership.test', 'Admin123!')}
          >
            Use admin
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fillDemo('customer@dealership.test', 'Customer123!')}
          >
            Use customer
          </Button>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-ink-400">
        No account yet?{' '}
        <Link to="/register" className="font-medium text-brand-400 hover:text-brand-300">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
