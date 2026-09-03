import { Inbox } from "lucide-react";

/**
 * Short line plus context. The `compact` variant is for an empty column — with
 * four columns on screen, four tall illustrated boxes would shout louder than
 * the content that is actually there.
 */
export function EmptyState({
  title,
  body,
  compact = false,
  className = "",
}: {
  title: string;
  body?: string;
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <p
        className={`rounded-card border border-dashed border-border px-4 py-5 text-center text-sm text-text-tertiary ${className}`}
      >
        {title}
      </p>
    );
  }

  return (
    <div
      className={`flex flex-col items-center rounded-card border border-dashed border-border px-5 py-8 text-center ${className}`}
    >
      <span className="mb-3 inline-flex size-10 items-center justify-center rounded-full bg-subtle text-muted">
        <Inbox className="size-5" strokeWidth={2} aria-hidden />
      </span>
      <p className="text-sm font-semibold text-text">{title}</p>
      {body ? <p className="mt-1 text-sm text-text-secondary">{body}</p> : null}
    </div>
  );
}
