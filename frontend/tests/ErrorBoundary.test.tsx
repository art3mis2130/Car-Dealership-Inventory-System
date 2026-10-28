import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '../src/components/ErrorBoundary.js';

function Explodes({ fail }: { fail: boolean }): React.ReactElement {
  if (fail) throw new Error('Rendering went wrong');

  return <p>All fine</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs the caught error; silence it so a passing run stays readable.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders its children when nothing goes wrong', () => {
    render(
      <ErrorBoundary>
        <Explodes fail={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('All fine')).toBeInTheDocument();
  });

  it('shows a recovery screen instead of a blank page when a child throws', () => {
    render(
      <ErrorBoundary>
        <Explodes fail />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('does not leak the raw error message to the user', () => {
    render(
      <ErrorBoundary>
        <Explodes fail />
      </ErrorBoundary>,
    );

    // The stack belongs in the console, not on screen.
    expect(screen.queryByText(/Rendering went wrong/)).not.toBeInTheDocument();
  });

  it('retries the render when the user asks it to', async () => {
    /*
     * The condition is read at render time from a mutable box rather than
     * passed as a prop: React re-invokes a throwing render once by itself to
     * capture a better stack, so a simple "fail the first time" counter
     * resolves before the boundary ever sees an error.
     */
    const control = { failing: true };

    function Flaky() {
      if (control.failing) throw new Error('Transient failure');

      return <p>All fine</p>;
    }

    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();

    control.failing = false;
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('All fine')).toBeInTheDocument();
  });
});
