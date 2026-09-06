import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import { HelpArticlesTable, type HelpArticleListItem } from "@/components/admin/help/HelpArticlesTable";
import { FIELD_CLASS } from "@/components/ui/Field";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getAdminHelpArticles, getAdminHelpCollections } from "@/lib/data/help-admin-repository";
import { formatDate } from "@/lib/format";
import { helpArticleHref } from "@/lib/help/paths";
import { HELP_ARTICLE_STATUSES } from "@/lib/help/types";
import { requireAdminPage } from "@/lib/auth/admin";

/** A1 — the articles list. Per-admin and always live, like the rest of the admin. */
export const dynamic = "force-dynamic";

function pick(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function HelpArticlesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/help">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPage();
  const dict = getDictionary(locale);
  const filters = await searchParams;
  const collectionFilter = pick(filters.collection);
  const statusFilter = pick(filters.status);
  const coverageFilter = pick(filters.coverage);

  const [rows, collections] = await Promise.all([
    getAdminHelpArticles(),
    getAdminHelpCollections(),
  ]);

  const visible: HelpArticleListItem[] = rows
    .filter((row) => !collectionFilter || row.collection.id === collectionFilter)
    .filter((row) => !statusFilter || row.status === statusFilter)
    .filter((row) =>
      coverageFilter === "missing-en"
        ? !row.en
        : coverageFilter === "missing-ar"
          ? !row.ar
          : coverageFilter === "alt-unreviewed"
            ? row.hasDraftAlt
            : coverageFilter === "needs-summary"
              ? row.needsSummary
              : coverageFilter === "review-due"
                ? row.reviewDue
                : true,
    )
    .map((row) => {
      const own = row[locale];
      return {
        ...row,
        updatedLabel: formatDate(row.updatedAt, locale),
        publicHref:
          row.status === "published" && own ? helpArticleHref(locale, own.slug) : null,
      };
    });

  const statusLabel = {
    draft: dict.adminHelp.statusDraft,
    published: dict.adminHelp.statusPublished,
    archived: dict.adminHelp.statusArchived,
  } as const;

  return (
    <main className="mx-auto w-full max-w-board px-5 py-8 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl/8 font-bold text-text">{dict.adminHelp.articlesTitle}</h1>
        <Link
          href={`/${locale}/admin/help/articles/new`}
          className="gradient-brand inline-flex h-10 items-center gap-2 rounded-control px-4 text-sm font-semibold text-white transition-opacity duration-(--dur-micro) hover:opacity-90"
        >
          <Plus className="size-4" strokeWidth={2} aria-hidden />
          {dict.adminHelp.newArticle}
        </Link>
      </div>

      <form method="get" className="mt-5 grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-secondary">
          {dict.adminHelp.filterCollection}
          <select name="collection" defaultValue={collectionFilter} className={FIELD_CLASS}>
            <option value="">{dict.adminHelp.allCollections}</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {locale === "ar" ? c.name_ar : c.name_en}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-secondary">
          {dict.adminHelp.filterStatus}
          <select name="status" defaultValue={statusFilter} className={FIELD_CLASS}>
            <option value="">{dict.adminHelp.allStatuses}</option>
            {HELP_ARTICLE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-secondary">
          {dict.adminHelp.filterCoverage}
          <select name="coverage" defaultValue={coverageFilter} className={FIELD_CLASS}>
            <option value="">{dict.adminHelp.allCoverage}</option>
            <option value="missing-en">{dict.adminHelp.coverageMissingEn}</option>
            <option value="missing-ar">{dict.adminHelp.coverageMissingAr}</option>
            <option value="alt-unreviewed">{dict.adminHelp.coverageAltUnreviewed}</option>
            <option value="needs-summary">{dict.adminHelp.coverageNeedsSummary}</option>
            <option value="review-due">{dict.adminHelp.coverageReviewDue}</option>
          </select>
        </label>
        {/* Selects submit on change via the button for keyboard users; the
            form is plain GET so the filter lives in the URL. */}
        <button type="submit" className="sr-only">
          {dict.adminHelp.filterStatus}
        </button>
      </form>

      <HelpArticlesTable rows={visible} locale={locale} dict={dict} />
    </main>
  );
}
