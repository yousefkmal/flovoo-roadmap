import type { HelpArticleSummary } from "@/lib/help/types";

export interface HelpArticleSection {
  title: string;
  articles: HelpArticleSummary[];
}

/**
 * Groups a topic's articles for the category page: one card per section, in
 * the order the sections first appear when articles are read in editorial
 * order. Articles with no section share a card titled `fallbackTitle`, which
 * comes first — the general reading before the specialised.
 */
export function groupArticlesBySection(
  articles: HelpArticleSummary[],
  fallbackTitle: string,
): HelpArticleSection[] {
  const groups = new Map<string, HelpArticleSummary[]>();
  for (const article of articles) {
    const key = article.section ?? "";
    const list = groups.get(key) ?? [];
    list.push(article);
    groups.set(key, list);
  }

  const sections: HelpArticleSection[] = [];
  const general = groups.get("");
  if (general) sections.push({ title: fallbackTitle, articles: general });
  for (const [title, list] of groups) {
    if (title !== "") sections.push({ title, articles: list });
  }
  return sections;
}
