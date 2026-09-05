import { notFound } from "next/navigation";

import { ContentGapInbox } from "@/components/admin/help/ContentGapInbox";
import { HelpAnalytics } from "@/components/admin/help/HelpAnalytics";
import { FIELD_CLASS } from "@/components/ui/Field";
import { getDictionary, t } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdminPage } from "@/lib/auth/admin";
import {
  getArticleTitles,
  getHelpContentGaps,
  getHelpDailyViews,
  getHelpHelpfulness,
  getHelpNegativeFeedback,
  getHelpOverview,
  getHelpRedirectHealth,
  getHelpTopArticles,
  getHelpTopQueries,
} from "@/lib/data/help-analytics";
import { formatDate } from "@/lib/format";
import { getChunkCoverage } from "@/lib/help/chunks";
import { EMBEDDING_MODEL, isEmbeddingConfigured } from "@/lib/help/embeddings";
import type { Locale } from "@/lib/types";

/** A6 — analytics and the content-gap inbox. Always live, like the rest of the admin. */
export const dynamic = "force-dynamic";

const WINDOWS = [7, 30, 90] as const;

export default async function HelpAnalyticsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/help/analytics">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPage();
  const dict = getDictionary(locale);

  const raw = (await searchParams).days;
  const requested = Number(Array.isArray(raw) ? raw[0] : raw);
  const days = (WINDOWS as readonly number[]).includes(requested) ? requested : 30;

  const [overview, daily, topArticles, topQueries, helpfulness, redirects, gaps, negative, coverage] =
    await Promise.all([
      getHelpOverview(days),
      getHelpDailyViews(days),
      getHelpTopArticles(days),
      getHelpTopQueries(days),
      getHelpHelpfulness(days),
      getHelpRedirectHealth(),
      getHelpContentGaps(),
      getHelpNegativeFeedback(),
      getChunkCoverage(),
    ]);

  const titles = await getArticleTitles([
    ...topArticles.map((r) => r.articleId),
    ...helpfulness.map((r) => r.articleId),
    ...negative.map((r) => r.articleId),
  ]);

  /** The title in the row's own language, falling back to whatever exists. */
  function labelFor(articleId: string, language: Locale) {
    const options = titles.get(articleId) ?? [];
    const match = options.find((o) => o.language === language) ?? options[0];
    return {
      title: match?.title ?? articleId.slice(0, 8),
      href: `/${locale}/admin/help/articles/${articleId}`,
    };
  }

  return (
    <main className="mx-auto w-full max-w-board px-5 py-8 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl/8 font-bold text-text">{dict.adminHelp.analyticsTitle}</h1>
        <form method="get">
          <label className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
            {dict.adminHelp.rangeLabel}
            <select name="days" defaultValue={String(days)} className={`${FIELD_CLASS} w-auto`}>
              {WINDOWS.map((window) => (
                <option key={window} value={window}>
                  {t(dict.adminHelp.rangeDays, { count: window })}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-control border border-border px-3 py-1.5 text-xs font-semibold text-text hover:border-flovoo-blue/40">
              {dict.adminHelp.rangeApply}
            </button>
          </label>
        </form>
      </div>

      <HelpAnalytics
        days={days}
        overview={overview}
        daily={daily}
        topArticles={topArticles}
        topQueries={topQueries}
        helpfulness={helpfulness}
        redirects={redirects}
        labelFor={labelFor}
        locale={locale}
        dict={dict}
      />

      <section aria-labelledby="content-gap" className="mt-10">
        <h2 id="content-gap" className="text-lg font-bold text-text">
          {dict.adminHelp.gapTitle}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">{dict.adminHelp.gapHint}</p>
        <ContentGapInbox
          locale={locale}
          dict={dict}
          queries={gaps.map((g) => ({
            query: g.query,
            language: g.language,
            searches: g.searches,
            lastSeenLabel: formatDate(g.lastSeen, locale),
          }))}
          feedback={negative.map((f) => ({
            id: f.id,
            articleTitle: labelFor(f.articleId, f.language).title,
            articleHref: labelFor(f.articleId, f.language).href,
            language: f.language,
            comment: f.comment,
            createdLabel: formatDate(f.createdAt, locale),
          }))}
        />
      </section>

      {/* The retrieval index the AI Agent reads. Honest about being off. */}
      <section aria-labelledby="rag-status" className="mt-10 rounded-card border border-border bg-column p-5">
        <h2 id="rag-status" className="text-sm font-bold text-text">
          {dict.adminHelp.ragTitle}
        </h2>
        <p className="numeric mt-1 text-sm text-text-secondary">
          {isEmbeddingConfigured
            ? t(dict.adminHelp.ragOn, {
                chunks: coverage.chunks,
                articles: coverage.articles,
                model: coverage.models.join(", ") || EMBEDDING_MODEL,
              })
            : dict.adminHelp.ragOff}
        </p>
      </section>
    </main>
  );
}
