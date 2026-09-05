import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Where the reader is. The last crumb is the current page and is not a link.
 * The separator is a directional chevron, so it mirrors in RTL.
 */
export function Breadcrumbs({ items, label }: { items: Crumb[]; label: string }) {
  return (
    <nav aria-label={label} className="text-sm text-text-secondary">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="truncate rounded-input font-medium transition-colors duration-(--dur-micro) hover:text-text"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className="truncate font-medium text-text"
                >
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <ChevronRight
                  className="size-4 shrink-0 text-muted rtl:-scale-x-100"
                  strokeWidth={2}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
