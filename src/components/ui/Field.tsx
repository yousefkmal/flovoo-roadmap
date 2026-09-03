import type { ReactNode } from "react";

/**
 * One labelled form field with its error. The error is wired with
 * `aria-describedby` and `aria-invalid` so it is announced rather than only
 * shown, and it is rendered in an `alert` region so it reaches a screen reader
 * the moment it appears.
 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-text">
        {label}
        {hint ? (
          <span className="ms-2 font-normal text-text-tertiary">{hint}</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const FIELD_CLASS =
  "w-full rounded-input border border-border bg-card px-3 py-2 text-sm text-text outline-none transition-colors duration-(--dur-micro) placeholder:text-placeholder focus:border-flovoo-blue aria-[invalid=true]:border-danger";
