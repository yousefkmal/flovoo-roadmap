import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { HelpArticleSection } from "@/lib/help/sections";

/**
 * One section of a topic on the category page: a card with the section's
 * name as its header and one single-line row per article. The chevron is a
 * directional glyph, so it mirrors in Arabic.
 */
export function ArticleSectionCard({
  section,
  hrefFor,
}: {
  section: HelpArticleSection;
  hrefFor: (slug: string) => string;
}) {
  return (
    <section className="overflow-hidden rounded-card border border-border bg-card">
      <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-text">
        {section.title}
      </h2>
      <ul className="divide-y divide-border">
        {section.articles.map((article) => (
          <li key={article.id}>
            <Link
              href={hrefFor(article.slug)}
              className="group flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-text transition-colors duration-(--dur-micro) hover:bg-subtle hover:text-link"
            >
              <span className="truncate">{article.title}</span>
              <ChevronRight
                className="size-4 shrink-0 text-muted transition-transform duration-(--dur-micro) group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                strokeWidth={2}
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
