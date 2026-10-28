import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { ApiError } from '../lib/api.js';
import { Button } from '../components/ui/Button.js';
import { TextField } from '../components/ui/Field.js';
import { AuthLayout } from './AuthLayout.js';

/**
 * Registration. Server-side validation errors are mapped back onto the field
 * they came from, so the user is not left guessing which input was wrong.
 */
export function RegisterPage() {
  const { register, user, initialising } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!initialising && user) return <Navigate to="/" replace />;

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFieldErrors({});
    setError(null);

    if (form.password !== form.confirm) {
      setFieldErrors({ confirm: 'Passwords do not match' });
      return;
    }

    setSubmitting(true);

    try {
      await register(form.name, form.email, form.password);
      navigate('/', { replace: true });
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.details?.length) {
        setFieldErrors(
          Object.fromEntries(cause.details.map((detail) => [detail.field, detail.message])),
        );
      } else if (cause instanceof ApiError) {
        setError(cause.message);
      } else {
        setError('Could not reach the server. Is the API running?');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="New accounts can browse and buy. Admin access is granted by the dealership."
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
        <TextField
          label="Full name"
          autoComplete="name"
          value={form.name}
          onChange={(event) => set('name', event.target.value)}
          error={fieldErrors.name}
          placeholder="Ada Lovelace"
          required
        />

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(event) => set('email', event.target.value)}
          error={fieldErrors.email}
          placeholder="you@example.com"
          required
        />

        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(event) => set('password', event.target.value)}
          error={fieldErrors.password}
          hint="At least 8 characters."
          required
        />

        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={(event) => set('confirm', event.target.value)}
          error={fieldErrors.confirm}
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
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-400">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-brand-400 hover:text-brand-300">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
