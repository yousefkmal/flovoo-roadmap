import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";

/** One row in a category or "most read" list. */
export function ArticleListItem({
  href,
  title,
  excerpt,
  readingLabel,
}: {
  href: string;
  title: string;
  excerpt: string | null;
  readingLabel: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-start gap-3 rounded-card border border-border bg-card px-4 py-3 transition-[border-color,box-shadow] duration-(--dur-micro) hover:border-flovoo-blue/40 hover:shadow-sm"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-5 text-text group-hover:text-link">
            {title}
          </span>
          {excerpt ? (
            <span className="clamp-2 mt-0.5 block text-[13px] leading-5 text-text-secondary">
              {excerpt}
            </span>
          ) : null}
          <span className="numeric mt-1.5 flex items-center gap-1.5 text-xs font-medium text-text-tertiary">
            <Clock className="size-3.5" strokeWidth={2} aria-hidden />
            {readingLabel}
          </span>
        </span>
        <ChevronRight
          className="mt-0.5 size-4 shrink-0 text-muted transition-transform duration-(--dur-micro) group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
          strokeWidth={2}
          aria-hidden
        />
      </Link>
    </li>
  );
}
