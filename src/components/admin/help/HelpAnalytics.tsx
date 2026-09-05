import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { t, type Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type {
  DailyViews,
  HelpOverview,
  Helpfulness,
  QueryStat,
  RedirectHealth,
  TopArticle,
} from "@/lib/data/help-analytics";

/**
 * A6 — the analytics dashboard. Plain aggregates, first-party, no third-party
 * tracker (brief §9). Everything renders on the server: these are counts, not
 * an interactive tool.
 *
 * Chart colours follow the Flovoo system's chart rule — the Sky → Blue ramp,
 * one hue per language — rather than a generic palette.
 */

export interface ArticleLabel {
  title: string;
  href: string;
}

export function HelpAnalytics({
  days,
  overview,
  daily,
  topArticles,
  topQueries,
  helpfulness,
  redirects,
  labelFor,
  locale,
  dict,
}: {
  days: number;
  overview: HelpOverview;
  daily: DailyViews[];
  topArticles: TopArticle[];
  topQueries: QueryStat[];
  helpfulness: Helpfulness[];
  redirects: RedirectHealth;
  labelFor: (articleId: string, language: Locale) => ArticleLabel;
  locale: Locale;
  dict: Dictionary;
}) {
  const a = dict.adminHelp;
  const helpfulPercent =
    overview.feedbackTotal > 0
      ? Math.round((overview.feedbackHelpful / overview.feedbackTotal) * 100)
      : null;
  const clickRate =
    overview.searchesTotal > 0
      ? Math.round((overview.searchesClicked / overview.searchesTotal) * 100)
      : null;

  return (
    <div className="mt-6 flex flex-col gap-8">
      <section aria-labelledby="stat-cards" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <h2 id="stat-cards" className="sr-only">
          {a.statsTitle}
        </h2>
        <StatCard
          label={a.statViews}
          value={overview.viewsTotal}
          delta={delta(overview.viewsTotal, overview.viewsPrevious)}
          hint={`ع ${overview.viewsAr} · EN ${overview.viewsEn}`}
        />
        <StatCard
          label={a.statSearches}
          value={overview.searchesTotal}
          hint={t(a.statZeroResults, { count: overview.searchesZero })}
        />
        <StatCard
          label={a.statClickRate}
          value={clickRate === null ? "—" : `${clickRate}%`}
          hint={t(a.statClicks, { count: overview.searchesClicked })}
        />
        <StatCard
          label={a.statHelpful}
          value={helpfulPercent === null ? "—" : `${helpfulPercent}%`}
          hint={t(a.statFeedback, { count: overview.feedbackTotal })}
        />
      </section>

      <ViewsChart daily={daily} days={days} dict={dict} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={a.topArticlesTitle} empty={topArticles.length === 0} emptyText={a.noDataYet}>
          <ol className="divide-y divide-border">
            {topArticles.map((row) => {
              const label = labelFor(row.articleId, row.language);
              return (
                <li key={`${row.articleId}-${row.language}`} className="flex items-center gap-3 px-4 py-2.5">
                  <Link href={label.href} className="min-w-0 flex-1 truncate text-sm text-text hover:text-link">
                    {label.title}
                  </Link>
                  <span className="shrink-0 text-xs font-semibold uppercase text-text-tertiary">
                    {row.language === "ar" ? "ع" : "EN"}
                  </span>
                  <span className="numeral shrink-0 text-sm font-semibold text-text">{row.views}</span>
                </li>
              );
            })}
          </ol>
        </Panel>

        <Panel title={a.topQueriesTitle} empty={topQueries.length === 0} emptyText={a.noDataYet}>
          <ol className="divide-y divide-border">
            {topQueries.map((row) => (
              <li key={`${row.query}-${row.language}`} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-text">{row.query}</span>
                {row.zeroResults > 0 ? (
                  <span className="shrink-0 rounded-pill bg-warning-tint px-2 py-0.5 text-xs font-semibold text-warning-label">
                    {t(a.zeroBadge, { count: row.zeroResults })}
                  </span>
                ) : null}
                <span className="numeral shrink-0 text-sm font-semibold text-text">{row.searches}</span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title={a.helpfulnessTitle} empty={helpfulness.length === 0} emptyText={a.noDataYet}>
          <table className="w-full text-sm">
            <thead className="bg-subtle text-xs font-semibold text-text-secondary">
              <tr>
                <th scope="col" className="px-4 py-2 text-start">{a.colTitle}</th>
                <th scope="col" className="px-2 py-2 text-start">{a.colHelpful}</th>
                <th scope="col" className="px-2 py-2 text-start">{a.colViews}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {helpfulness.map((row) => {
                const label = labelFor(row.articleId, row.language);
                const total = row.helpful + row.unhelpful;
                const percent = total > 0 ? Math.round((row.helpful / total) * 100) : null;
                return (
                  <tr key={`${row.articleId}-${row.language}`}>
                    <td className="max-w-xs truncate px-4 py-2">
                      <Link href={label.href} className="text-text hover:text-link">{label.title}</Link>
                    </td>
                    <td className="numeral px-2 py-2">
                      <span className={percent !== null && percent < 60 ? "font-semibold text-danger" : "text-text"}>
                        {percent === null ? "—" : `${percent}%`}
                      </span>
                      <span className="ms-1 text-xs text-text-tertiary">({total})</span>
                    </td>
                    <td className="numeral px-2 py-2 text-text-secondary">{row.views}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel
          title={a.redirectHealthTitle}
          empty={redirects.topRedirects.length === 0 && redirects.topMissing.length === 0}
          emptyText={a.noDataYet}
        >
          <div className="flex flex-col gap-4 p-4">
            {redirects.topRedirects.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-text-secondary">{a.redirectTopHits}</p>
                <ul className="flex flex-col gap-1">
                  {redirects.topRedirects.map((row) => (
                    <li key={row.sourcePath} className="flex items-center gap-2 text-sm">
                      <span className="numeral min-w-0 flex-1 truncate text-text" dir="ltr">{row.sourcePath}</span>
                      <span className="numeral shrink-0 font-semibold text-text">{row.hits}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {redirects.topMissing.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-text-secondary">{a.redirect404s}</p>
                <ul className="flex flex-col gap-1">
                  {redirects.topMissing.map((row) => (
                    <li key={row.path} className="flex items-center gap-2 text-sm">
                      <span className="numeral min-w-0 flex-1 truncate text-text-secondary" dir="ltr">{row.path}</span>
                      <span className="numeral shrink-0 font-semibold text-text">{row.hits}</span>
                    </li>
                  ))}
                </ul>
                <Link href={`/${locale}/admin/help/redirects`} className="mt-2 inline-block text-xs font-semibold text-link hover:underline">
                  {a.navRedirects}
                </Link>
              </div>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function StatCard({
  label,
  value,
  hint,
  delta: change,
}: {
  label: string;
  value: number | string;
  hint?: string;
  delta?: number | null;
}) {
  const Icon = change === null || change === undefined ? Minus : change >= 0 ? ArrowUpRight : ArrowDownRight;
  const tone =
    change === null || change === undefined
      ? "text-text-tertiary"
      : change >= 0
        ? "text-success-label"
        : "text-danger";

  return (
    <div className="rounded-card border border-border bg-card p-4">
      <p className="text-xs font-semibold text-text-secondary">{label}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="numeral text-2xl font-bold text-text">{value}</span>
        {change !== undefined ? (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${tone}`}>
            <Icon className="size-3.5" strokeWidth={2} aria-hidden />
            <span className="numeral">{change === null ? "—" : `${Math.abs(change)}%`}</span>
          </span>
        ) : null}
      </p>
      {hint ? <p className="numeric mt-0.5 text-xs text-text-tertiary">{hint}</p> : null}
    </div>
  );
}

/**
 * Daily reads, Arabic over English. Bars rather than a line: the numbers are
 * small and a line between two-view days implies a precision that is not there.
 * The table under it is what a screen reader gets.
 */
function ViewsChart({ daily, days, dict }: { daily: DailyViews[]; days: number; dict: Dictionary }) {
  const max = Math.max(1, ...daily.map((d) => d.ar + d.en));
  const a = dict.adminHelp;

  return (
    <section aria-labelledby="views-chart" className="rounded-card border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="views-chart" className="text-sm font-bold text-text">
          {t(a.viewsChartTitle, { days })}
        </h2>
        <p className="flex items-center gap-3 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-flovoo-blue" aria-hidden />
            {a.legendAr}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-flovoo-sky" aria-hidden />
            {a.legendEn}
          </span>
        </p>
      </div>

      <div className="mt-4 flex h-32 items-end gap-px" aria-hidden>
        {daily.map((day) => {
          const total = day.ar + day.en;
          return (
            <div key={day.day} className="flex h-full flex-1 flex-col justify-end" title={`${day.day}: ${total}`}>
              {day.en > 0 ? (
                <div className="w-full rounded-t-[2px] bg-flovoo-sky" style={{ height: `${(day.en / max) * 100}%` }} />
              ) : null}
              {day.ar > 0 ? (
                <div
                  className={`w-full bg-flovoo-blue ${day.en === 0 ? "rounded-t-[2px]" : ""}`}
                  style={{ height: `${(day.ar / max) * 100}%` }}
                />
              ) : null}
              {total === 0 ? <div className="h-px w-full bg-border" /> : null}
            </div>
          );
        })}
      </div>

      <table className="sr-only">
        <caption>{t(a.viewsChartTitle, { days })}</caption>
        <thead>
          <tr>
            <th scope="col">{a.colDay}</th>
            <th scope="col">{a.legendAr}</th>
            <th scope="col">{a.legendEn}</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((day) => (
            <tr key={day.day}>
              <th scope="row">{day.day}</th>
              <td>{day.ar}</td>
              <td>{day.en}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Panel({
  title,
  children,
  empty,
  emptyText,
}: {
  title: string;
  children: React.ReactNode;
  empty: boolean;
  emptyText: string;
}) {
  return (
    <section className="overflow-hidden rounded-card border border-border bg-card">
      <h2 className="border-b border-border px-4 py-3 text-sm font-bold text-text">{title}</h2>
      {empty ? <p className="px-4 py-6 text-sm text-text-tertiary">{emptyText}</p> : children}
    </section>
  );
}
