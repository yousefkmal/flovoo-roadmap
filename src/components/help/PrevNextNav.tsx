import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import type { HelpArticleNeighbour } from "@/lib/help/types";

/**
 * Previous and next inside the same topic. "Previous" sits at the inline
 * start and points backwards in reading direction, so the arrows are the
 * logical pair and mirror with the page.
 */
export function PrevNextNav({
  previous,
  next,
  hrefFor,
  labels,
}: {
  previous: HelpArticleNeighbour | null;
  next: HelpArticleNeighbour | null;
  hrefFor: (slug: string) => string;
  labels: { previous: string; next: string };
}) {
  if (!previous && !next) return null;

  return (
    <nav aria-label={`${labels.previous} / ${labels.next}`} className="grid gap-2.5 sm:grid-cols-2">
      {previous ? (
        <Link
          href={hrefFor(previous.slug)}
          rel="prev"
          className="group flex flex-col gap-0.5 rounded-card border border-border bg-card px-4 py-3 transition-colors duration-(--dur-micro) hover:border-flovoo-blue/40"
        >
          <span className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary">
            <ArrowLeft className="size-3.5 rtl:-scale-x-100" strokeWidth={2} aria-hidden />
            {labels.previous}
          </span>
          <span className="text-sm font-semibold leading-5 text-text group-hover:text-link">
            {previous.title}
          </span>
        </Link>
      ) : (
        <span aria-hidden />
      )}
      {next ? (
        <Link
          href={hrefFor(next.slug)}
          rel="next"
          className="group flex flex-col items-end gap-0.5 rounded-card border border-border bg-card px-4 py-3 text-end transition-colors duration-(--dur-micro) hover:border-flovoo-blue/40"
        >
          <span className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary">
            {labels.next}
            <ArrowRight className="size-3.5 rtl:-scale-x-100" strokeWidth={2} aria-hidden />
          </span>
          <span className="text-sm font-semibold leading-5 text-text group-hover:text-link">
            {next.title}
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
