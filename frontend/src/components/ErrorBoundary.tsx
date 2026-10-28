import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui/Button.js';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render-time errors anywhere below it.
 *
 * Without one, a single thrown error unmounts the whole tree and the user is
 * left looking at a blank white page with no idea what happened. This at
 * least explains the situation and offers a way out.
 *
 * It has to be a class: there is still no hook equivalent of
 * componentDidCatch.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // The console is where a developer looks; the screen is not the place for
    // a stack trace. A real deployment would forward this to an error tracker.
    console.error('Unhandled render error:', error, info.componentStack);
  }

  private readonly retry = (): void => {
    this.setState({ hasError: false });
  };

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="grid min-h-[60vh] place-items-center px-4">
        <div className="surface max-w-md p-8 text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-danger-500/40 bg-danger-500/10">
            <svg
              className="h-7 w-7 text-danger-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </span>

          <h1 className="text-xl font-semibold text-ink-100">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink-400">
            This part of the page failed to render. Nothing you were working on has been sent
            anywhere, and trying again usually clears it.
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={this.retry}>Try again</Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Reload the page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
