import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ArticleListItem } from "@/components/help/ArticleListItem";
import { EscalationCard } from "@/components/help/EscalationCard";
import { HelpHeader } from "@/components/help/HelpHeader";
import { HelpSearch } from "@/components/help/HelpSearch";
import { HelpShell } from "@/components/help/HelpShell";
import { SearchResultList } from "@/components/help/SearchResultList";
import { SiteFooter } from "@/components/SiteFooter";
import { EmptyState } from "@/components/ui/EmptyState";
import { getDictionary, t } from "@/i18n";
import { isLocale, otherLocale } from "@/i18n/config";
import { logHelpSearch } from "@/lib/data/help-mutations";
import { getHelpNavigation, getPinnedHelpArticles } from "@/lib/data/help-repository";
import { readingTimeLabel, searchCountLabel } from "@/lib/help/format";
import { helpArticleHref, helpFooterLinks, helpSearchHref } from "@/lib/help/paths";
import { ipHashFrom } from "@/lib/help/request";
import { helpSearchLabels } from "@/lib/help/labels";
import { MIN_QUERY_LENGTH, searchHelp } from "@/lib/help/search";
import { siteUrl } from "@/lib/site";

/**
 * P4 — full results for a query. Rendered per request: the query is in the
 * URL and every search is logged, so nothing here can be prerendered. Search
 * pages are kept out of search engines; the articles they point at are the
 * pages that should rank.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/help/search">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: `${dict.help.searchTitle} · ${dict.help.badge}`,
    robots: { index: false, follow: true },
  };
}

export default async function HelpSearchPage({
  params,
  searchParams,
}: PageProps<"/[locale]/help/search">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw ?? "").trim().slice(0, 200);
  const dict = getDictionary(locale);

  const [navigation, response] = await Promise.all([
    getHelpNavigation(locale),
    query.length >= MIN_QUERY_LENGTH
      ? searchHelp(locale, query, 20)
      : Promise.resolve({ query, results: [], semantic: false }),
  ]);

  // Log what was searched for; zero results are the point, not an error.
  const queryId =
    query.length >= MIN_QUERY_LENGTH
      ? await logHelpSearch({
          query,
          locale,
          resultsCount: response.results.length,
          ipHash: ipHashFrom(await headers()),
        })
      : null;

  const popular = response.results.length === 0 ? await getPinnedHelpArticles(locale, 4) : [];
  const active = { collectionId: null, articleId: null };
  const alternateHref = `${helpSearchHref(otherLocale(locale))}${query ? `?q=${encodeURIComponent(query)}` : ""}`;

  return (
    <>
      <a
        href="#help-search"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-control focus:bg-flovoo-navy focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {dict.nav.skipToContent}
      </a>

      <HelpHeader
        locale={locale}
        alternateHref={alternateHref}
        collections={navigation}
        active={active}
        showSearch={false}
      />

      <HelpShell locale={locale} collections={navigation} active={active}>
        <main id="help-search" className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-3xl">
            <HelpSearch
              locale={locale}
              variant="hero"
              action={helpSearchHref(locale)}
              labels={helpSearchLabels(dict)}
              initialQuery={query}
            />

            {query.length < MIN_QUERY_LENGTH ? (
              <EmptyState
                className="mt-8"
                title={dict.help.searchEmptyTitle}
                body={dict.help.searchEmptyBody}
              />
            ) : (
              <>
                <header className="mt-8">
                  <h1 className="text-xl font-bold text-text">
                    {t(dict.help.searchFor, { query })}
                  </h1>
                  <p className="mt-1 text-xs font-medium text-text-tertiary">
                    {searchCountLabel(dict, locale, response.results.length)}
                  </p>
                </header>

                {response.results.length > 0 ? (
                  <div className="mt-5">
                    <SearchResultList
                      queryId={queryId}
                      inCollectionLabel={dict.help.searchIn}
                      results={response.results.map((result) => ({
                        id: result.id,
                        href: helpArticleHref(locale, result.slug),
                        titleParts: result.titleParts,
                        collection: result.collection.name,
                        snippet: result.snippet,
                      }))}
                    />
                  </div>
                ) : (
                  <>
                    <EmptyState
                      className="mt-5"
                      title={t(dict.help.searchNoResultsTitle, { query })}
                      body={dict.help.searchNoResultsBody}
                    />
                    {popular.length > 0 ? (
                      <section aria-labelledby="help-search-popular" className="mt-8">
                        <h2 id="help-search-popular" className="mb-3 text-base font-bold text-text">
                          {dict.help.popularTitle}
                        </h2>
                        <ul className="grid gap-2.5 sm:grid-cols-2">
                          {popular.map((article) => (
                            <ArticleListItem
                              key={article.id}
                              href={helpArticleHref(locale, article.slug)}
                              title={article.title}
                              excerpt={article.excerpt}
                              readingLabel={readingTimeLabel(dict, locale, article.readingMinutes)}
                            />
                          ))}
                        </ul>
                      </section>
                    ) : null}
                  </>
                )}
              </>
            )}

            <div className="mt-10">
              <EscalationCard dict={dict} />
            </div>
          </div>
        </main>
      </HelpShell>

      <SiteFooter
        locale={locale}
        updatedAt={null}
        links={helpFooterLinks(locale, siteUrl(), {
          roadmap: dict.help.roadmapLink,
          updates: dict.nav.updates,
        })}
      />
    </>
  );
}
