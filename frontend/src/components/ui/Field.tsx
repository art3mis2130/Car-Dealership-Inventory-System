import {
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

const CONTROL_CLASSES =
  'w-full rounded-lg border border-ink-600 bg-ink-850/80 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-400 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30 disabled:opacity-50';

interface FieldWrapperProps {
  label: string;
  error?: string;
  hint?: string;
}

/** Shared label/error chrome, so every control reports problems the same way. */
function Wrapper({
  label,
  error,
  hint,
  id,
  children,
}: FieldWrapperProps & { id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-danger-300">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  error,
  hint,
  className = '',
  ...rest
}: FieldWrapperProps & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const id = rest.id ?? generatedId;

  return (
    <Wrapper label={label} error={error} hint={hint} id={id}>
      <input
        {...rest}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${CONTROL_CLASSES} ${error ? 'border-danger-500/60' : ''} ${className}`}
      />
    </Wrapper>
  );
}

export function SelectField({
  label,
  error,
  hint,
  children,
  className = '',
  ...rest
}: FieldWrapperProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const generatedId = useId();
  const id = rest.id ?? generatedId;

  return (
    <Wrapper label={label} error={error} hint={hint} id={id}>
      <select
        {...rest}
        id={id}
        aria-invalid={error ? true : undefined}
        className={`${CONTROL_CLASSES} appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-9 ${className}`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
        }}
      >
        {children}
      </select>
    </Wrapper>
  );
}

export function TextAreaField({
  label,
  error,
  hint,
  className = '',
  ...rest
}: FieldWrapperProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId();
  const id = rest.id ?? generatedId;

  return (
    <Wrapper label={label} error={error} hint={hint} id={id}>
      <textarea
        {...rest}
        id={id}
        aria-invalid={error ? true : undefined}
        className={`${CONTROL_CLASSES} resize-y ${className}`}
      />
    </Wrapper>
  );
}
