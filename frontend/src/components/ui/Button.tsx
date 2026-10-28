import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

/*
 * Hover styles are scoped with `enabled:` on purpose. Plain `hover:` would
 * keep firing on a disabled control, and the disabled styling below would be
 * fighting it - which is how a disabled primary button ended up rendering as
 * near-black text on no background at all.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-ink-950 font-semibold enabled:hover:bg-brand-400 enabled:active:bg-brand-600 shadow-glow',
  secondary:
    'border border-ink-600 bg-ink-800/80 text-ink-100 enabled:hover:border-ink-500 enabled:hover:bg-ink-700',
  ghost: 'text-ink-200 enabled:hover:bg-ink-800 enabled:hover:text-ink-100',
  danger:
    'border border-danger-500/50 bg-danger-500/10 text-danger-300 enabled:hover:bg-danger-500/20',
};

/*
 * One explicit appearance for every disabled button, rather than fading the
 * variant out: "unavailable" should read as a distinct state, and the label
 * has to stay legible. This is the state the purchase button sits in whenever
 * a vehicle is out of stock, so it is worth being deliberate about.
 */
const DISABLED_CLASSES =
  'disabled:cursor-not-allowed disabled:border-ink-600 disabled:bg-ink-700 disabled:text-ink-300 disabled:shadow-none';

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

/**
 * The only button in the app.
 *
 * Variants rather than ad-hoc class strings keep every call to action
 * consistent, and the disabled state is handled once - which matters here
 * because "out of stock" has to be visibly and genuinely unclickable.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg transition-all duration-150 ${VARIANTS[variant]} ${DISABLED_CLASSES} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
