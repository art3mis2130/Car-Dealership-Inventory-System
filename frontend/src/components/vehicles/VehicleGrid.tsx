import type { ReactNode } from 'react';

/** Shared grid shell, so the card grid and its skeletons line up exactly. */
export function VehicleGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

/** Placeholder cards shown while the first page loads. */
export function VehicleGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <VehicleGrid>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="surface overflow-hidden" aria-hidden="true">
          <div className="skeleton h-36 rounded-none" />
          <div className="space-y-3 p-5">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-5 w-36" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-7 w-28" />
            <div className="skeleton h-10 w-full" />
          </div>
        </div>
      ))}
    </VehicleGrid>
  );
}

interface EmptyStateProps {
  title: string;
  message: string;
  action?: ReactNode;
}

/** Shown when a search matches nothing, or the lot is genuinely empty. */
export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="surface flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-ink-700 bg-ink-850">
        <svg
          className="h-7 w-7 text-ink-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </span>
      <h3 className="text-lg font-semibold text-ink-100">{title}</h3>
      <p className="max-w-sm text-sm text-ink-400">{message}</p>
      {action}
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="rounded-lg border border-ink-600 px-3 py-2 text-sm text-ink-200 transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>

      <p className="px-2 text-sm text-ink-400" aria-live="polite">
        Page <span className="font-semibold text-ink-100">{page}</span> of {totalPages}
      </p>

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-lg border border-ink-600 px-3 py-2 text-sm text-ink-200 transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  );
}
