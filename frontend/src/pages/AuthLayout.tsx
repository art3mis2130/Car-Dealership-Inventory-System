import type { ReactNode } from 'react';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

/**
 * Split-screen shell for sign-in and registration: marketing on the left,
 * the form on the right, collapsing to just the form on a phone.
 */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-ink-700/60 p-12 lg:flex">
        <div
          className="absolute inset-0 bg-gradient-to-br from-brand-500/15 via-transparent to-info-400/10"
          aria-hidden="true"
        />

        <div className="relative">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-400">
            Apex Motors
          </p>
          <h1 className="mt-6 max-w-md text-4xl font-bold leading-tight tracking-tight">
            The whole lot, {''}
            <span className="text-brand-400">one screen</span>.
          </h1>
          <p className="mt-4 max-w-md text-ink-300">
            Live stock levels, instant search across every make and model, and a purchase that
            updates inventory the moment it goes through.
          </p>
        </div>

        <ul className="relative space-y-3">
          {[
            'Search by make, model, category or price range',
            'Stock counts that cannot be oversold',
            'Admin tools for listing, pricing and restocking',
          ].map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-sm text-ink-200">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-500/15 text-brand-400">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md animate-fade-up">
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="mt-1.5 mb-7 text-sm text-ink-400">{subtitle}</p>
          {children}
        </div>
      </section>
    </div>
  );
}
