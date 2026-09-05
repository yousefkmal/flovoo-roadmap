import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { HelpRelatedArticle } from "@/lib/help/search";

/** "Read next": the closest articles, same topic first. */
export function RelatedArticles({
  articles,
  title,
  hrefFor,
}: {
  articles: HelpRelatedArticle[];
  title: string;
  hrefFor: (slug: string) => string;
}) {
  if (articles.length === 0) return null;

  return (
    <section aria-labelledby="help-related-title">
      <h2 id="help-related-title" className="mb-3 text-base font-bold text-text">
        {title}
      </h2>
      <ul className="overflow-hidden rounded-card border border-border bg-card divide-y divide-border">
        {articles.map((article) => (
          <li key={article.id}>
            <Link
              href={hrefFor(article.slug)}
              className="group flex items-center justify-between gap-3 px-4 py-2.5 transition-colors duration-(--dur-micro) hover:bg-subtle"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-text group-hover:text-link">
                  {article.title}
                </span>
                <span className="block text-xs text-text-tertiary">{article.collectionName}</span>
              </span>
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
