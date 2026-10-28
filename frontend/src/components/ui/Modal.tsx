import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Everything that can hold focus inside the panel, in document order. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * An accessible dialog.
 *
 * The native <dialog> element would give focus trapping and Escape handling
 * for free, but jsdom does not implement showModal(), so the behaviour would
 * be impossible to test. It is therefore implemented by hand and tested:
 *
 * - focus moves into the panel on open and returns to whatever opened it
 * - Tab and Shift+Tab cycle within the panel instead of escaping behind it
 * - Escape closes, and so does clicking the backdrop
 * - the backdrop is a real button, so "click outside to close" is reachable
 *   from the keyboard rather than being a mouse-only affordance
 * - page scrolling is locked while it is open, and restored afterwards
 */
export function Modal({ open, title, description, onClose, children, footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const trapFocus = useCallback((event: KeyboardEvent) => {
    const panel = panelRef.current;
    if (!panel) return;

    /*
     * Deliberately not filtered by offsetParent: every element inside a
     * position:fixed container reports offsetParent === null, so that check
     * would collapse the list to a single element and trap focus on it.
     * The selector already excludes disabled controls and tabindex="-1";
     * only explicitly hidden subtrees need excluding beyond that.
     */
    const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (element) => !element.hasAttribute('hidden') && !element.closest('[aria-hidden="true"]'),
    );

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'Tab') trapFocus(event);
    };

    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first control in the body rather than the close button: a
    // restock dialog should land the cursor in the quantity field, not on
    // the X. Falls back to the panel's first focusable if the body has none.
    const target =
      bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);

    target?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      // Return focus to whatever opened the dialog.
      previouslyFocused?.focus?.();
    };
  }, [open, onClose, trapFocus]);

  if (!open) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-40 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6">
      {/*
        A real button rather than a div with a click handler, so it is a
        genuine control rather than a div that happens to respond to a mouse.
        Hidden from assistive technology and skipped by Tab on purpose: it
        would otherwise be a second, identically named "Close dialog" control.
        The keyboard path for dismissing is Escape, which is tested.
      */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        data-testid="modal-backdrop"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-ink-950/80 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="surface animate-fade-up relative w-full max-w-xl rounded-b-none p-6 shadow-lift sm:rounded-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-ink-100">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-ink-400">
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
            aria-label="Close dialog"
          >
            <svg
              className="h-5 w-5"
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

        <div ref={bodyRef}>{children}</div>

        {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}
