import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button.js';

/**
 * A real 404 screen.
 *
 * Silently redirecting an unknown URL to the dashboard hides typos and broken
 * links; saying so and offering the way back is more honest and easier to
 * debug.
 */
export function NotFoundPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-400">Error 404</p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight">This page is not on the lot</h1>

        <p className="mt-3 text-sm text-ink-400">
          The address you followed does not match anything here. It may have been mistyped, or the
          listing it pointed at may have been sold.
        </p>

        <div className="mt-7 flex justify-center gap-3">
          <Link to="/">
            <Button>Back to the showroom</Button>
          </Link>
          <Link to="/purchases">
            <Button variant="secondary">My purchases</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
