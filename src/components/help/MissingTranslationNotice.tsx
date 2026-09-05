"use client";

import { Languages } from "lucide-react";
import { useSearchParams } from "next/navigation";

/**
 * Shown at the top of a category when the reader switched language from an
 * article that has no counterpart yet: the switcher sent them to the nearest
 * category with `?missing=1`. Reading the query string on the client keeps
 * the category page itself static.
 */
export function MissingTranslationNotice({ title, body }: { title: string; body: string }) {
  const params = useSearchParams();
  if (params.get("missing") !== "1") return null;

  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-card border border-border bg-info-tint px-4 py-3"
    >
      <Languages className="mt-0.5 size-5 shrink-0 text-info-label" strokeWidth={2} aria-hidden />
      <div>
        <p className="text-sm font-semibold text-text">{title}</p>
        <p className="mt-0.5 text-sm text-text-secondary">{body}</p>
      </div>
    </div>
  );
}
