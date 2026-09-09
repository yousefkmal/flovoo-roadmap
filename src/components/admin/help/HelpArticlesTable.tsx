"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Pin, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";

import { setHelpArticlesStatusAction } from "@/app/[locale]/admin/help/actions";
import { EmptyState } from "@/components/ui/EmptyState";
import { t, type Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { articleCountLabel } from "@/lib/help/format";
import type { HelpAdminArticleRow, HelpArticleStatus } from "@/lib/help/types";

export interface HelpArticleListItem extends HelpAdminArticleRow {
  updatedLabel: string;
  publicHref: string | null;
}

const STATUS_STYLE: Record<HelpArticleStatus, string> = {
  draft: "bg-subtle text-text-secondary",
  published: "bg-success-tint text-success-label",
  archived: "bg-warning-tint text-warning-label",
};

/**
 * The articles list: one row per article with whatever translations it has,
 * a coverage badge when one is missing, and bulk status changes on a
 * selection. Filtering is in the URL (the form above the table is a plain
 * GET), so a filtered view can be bookmarked.
 */
export function HelpArticlesTable({
  rows,
  locale,
  dict,
}: {
  rows: HelpArticleListItem[];
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulk(status: HelpArticleStatus) {
    const ids = [...selected];
    if (ids.length === 0) return;
    setNotice(null);
    startTransition(async () => {
      const result = await setHelpArticlesStatusAction(locale, ids, status);
      if (result.status === "ok") {
        setNotice(t(dict.adminHelp.bulkDone, { count: articleCountLabel(dict, locale, result.count) }));
        setSelected(new Set());
        router.refresh();
      } else if (result.status === "altMissing") {
        // Name the ones in the way: "it failed" is not actionable when the
        // selection is twenty articles long.
        setNotice(`${dict.adminHelp.bulkAltMissing} ${result.titles.join(" · ")}`);
      } else {
        setNotice(dict.adminHelp.saveFailed);
      }
    });
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        className="mt-6"
        title={dict.adminHelp.listEmpty}
        body={dict.adminHelp.listEmptyBody}
      />
    );
  }

  const statusLabel: Record<HelpArticleStatus, string> = {
    draft: dict.adminHelp.statusDraft,
    published: dict.adminHelp.statusPublished,
    archived: dict.adminHelp.statusArchived,
  };

  return (
    <div className="mt-4">
      <div className="flex min-h-10 flex-wrap items-center gap-2 text-sm">
        {selected.size > 0 ? (
          <>
            <span className="numeric font-semibold text-text">
              {t(dict.adminHelp.selectedCount, { count: selected.size })}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => bulk("published")}
              className="inline-flex h-8 items-center rounded-control bg-brand-solid px-3 text-sm font-semibold text-brand-solid-text transition-opacity duration-(--dur-micro) hover:opacity-90 disabled:opacity-60"
            >
              {dict.adminHelp.bulkPublish}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => bulk("draft")}
              className="inline-flex h-8 items-center rounded-control border border-border px-3 text-sm font-semibold text-text-secondary transition-colors duration-(--dur-micro) hover:text-text disabled:opacity-60"
            >
              {dict.adminHelp.bulkUnpublish}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => bulk("archived")}
              className="inline-flex h-8 items-center rounded-control border border-border px-3 text-sm font-semibold text-text-secondary transition-colors duration-(--dur-micro) hover:text-text disabled:opacity-60"
            >
              {dict.adminHelp.bulkArchive}
            </button>
          </>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm text-text-secondary">
            {notice}
          </p>
        ) : null}
      </div>

      <div className="mt-2 overflow-x-auto rounded-card border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-subtle text-xs font-semibold text-text-secondary">
            <tr>
              <th scope="col" className="w-10 px-3 py-2.5 text-start">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label={dict.adminHelp.selectAll}
                  className="size-4 accent-flovoo-blue"
                />
              </th>
              <th scope="col" className="px-3 py-2.5 text-start">{dict.adminHelp.colTitle}</th>
              <th scope="col" className="px-3 py-2.5 text-start">{dict.adminHelp.colCollection}</th>
              <th scope="col" className="px-3 py-2.5 text-start">{dict.adminHelp.colStatus}</th>
              <th scope="col" className="px-3 py-2.5 text-start">{dict.adminHelp.colLanguages}</th>
              <th scope="col" className="px-3 py-2.5 text-start">{dict.checks.columnLabel}</th>
              <th scope="col" className="px-3 py-2.5 text-start">{dict.adminHelp.colUpdated}</th>
              <th scope="col" className="px-3 py-2.5">
                <span className="sr-only">{dict.adminHelp.edit}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const primary = locale === "ar" ? row.ar ?? row.en : row.en ?? row.ar;
              const secondary = locale === "ar" ? row.en : row.ar;
              const collectionName = locale === "ar" ? row.collection.name_ar : row.collection.name_en;
              return (
                <tr key={row.id} className={selected.has(row.id) ? "bg-info-tint/40" : undefined}>
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label={t(dict.adminHelp.selectRow, { title: primary?.title ?? row.id })}
                      className="size-4 accent-flovoo-blue"
                    />
                  </td>
                  <td className="max-w-md px-3 py-2.5">
                    <Link
                      href={`/${locale}/admin/help/articles/${row.id}`}
                      className="block truncate font-semibold text-text hover:text-link"
                    >
                      {row.isPinned ? (
                        <Pin className="me-1 inline size-3.5 text-muted" strokeWidth={2} aria-label={dict.adminHelp.pinned} />
                      ) : null}
                      {primary?.title ?? "—"}
                    </Link>
                    {secondary ? (
                      <span className="block truncate text-xs text-text-tertiary" lang={locale === "ar" ? "en" : "ar"}>
                        {secondary.title}
                      </span>
                    ) : null}
                    {row.hasDraftAlt ? (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-warning-tint px-2 py-0.5 text-[11px] font-semibold text-warning-label">
                        <TriangleAlert className="size-3 shrink-0" strokeWidth={2.5} aria-hidden />
                        {dict.adminHelp.coverageAltUnreviewed}
                      </span>
                    ) : null}
                    {row.summaryUnreviewed ? (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-warning-tint px-2 py-0.5 text-[11px] font-semibold text-warning-label">
                        <TriangleAlert className="size-3 shrink-0" strokeWidth={2.5} aria-hidden />
                        {dict.adminHelp.summaryUnreviewed}
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-text-secondary">{collectionName}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[row.status]}`}>
                      {statusLabel[row.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {row.ar && row.en ? (
                      <span className="text-xs font-semibold text-text-secondary">ع · EN</span>
                    ) : (
                      <span className="rounded-pill bg-warning-tint px-2 py-0.5 text-xs font-semibold text-warning-label">
                        {row.en ? dict.adminHelp.badgeMissingAr : dict.adminHelp.badgeMissingEn}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <ReadinessCell readiness={row.readiness} locale={locale} />
                  </td>
                  <td className="numeric whitespace-nowrap px-3 py-2.5 text-text-tertiary">{row.updatedLabel}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-end">
                    <span className="inline-flex items-center gap-1">
                      {row.publicHref ? (
                        <a
                          href={row.publicHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={dict.adminHelp.viewPublic}
                          className="inline-flex size-8 items-center justify-center rounded-input text-muted transition-colors duration-(--dur-micro) hover:bg-subtle hover:text-text"
                        >
                          <ExternalLink className="size-4" strokeWidth={2} aria-hidden />
                        </a>
                      ) : null}
                      <Link
                        href={`/${locale}/admin/help/articles/${row.id}`}
                        aria-label={dict.adminHelp.edit}
                        className="inline-flex size-8 items-center justify-center rounded-input text-muted transition-colors duration-(--dur-micro) hover:bg-subtle hover:text-text"
                      >
                        <Pencil className="size-4" strokeWidth={2} aria-hidden />
                      </Link>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The readiness score per language, worst first.
 *
 * Two numbers rather than an average: an article can be finished in Arabic and
 * half-written in English, and an average would hide exactly the half that
 * needs the afternoon.
 */
function ReadinessCell({
  readiness,
  locale,
}: {
  readiness: { ar: number | null; en: number | null };
  locale: Locale;
}) {
  const order: Locale[] = locale === "ar" ? ["ar", "en"] : ["en", "ar"];
  const shown = order.filter((language) => readiness[language] !== null);
  if (shown.length === 0) return <span className="text-xs text-text-tertiary">—</span>;
  return (
    <span className="flex items-center gap-2">
      {shown.map((language) => {
        const score = readiness[language]!;
        const tone =
          score >= 80 ? "text-success-label" : score >= 55 ? "text-warning-label" : "text-danger";
        return (
          <span key={language} className="inline-flex items-baseline gap-1">
            <span className="text-[11px] uppercase text-text-tertiary">
              {language === "ar" ? "ع" : "EN"}
            </span>
            <span className={`numeral text-xs font-bold ${tone}`}>{score}</span>
          </span>
        );
      })}
    </span>
  );
}
