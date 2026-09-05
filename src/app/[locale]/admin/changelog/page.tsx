import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import {
  AdminChangelogList,
  type AdminChangelogView,
} from "@/components/admin/ChangelogList";
import { FIELD_CLASS } from "@/components/ui/Field";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getAllChangelogEntries } from "@/lib/data/admin-repository";
import { formatDate } from "@/lib/format";
import { requireAdminPage } from "@/lib/auth/admin";

function pick(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function AdminChangelogPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/changelog">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPage();

  const dict = getDictionary(locale);
  const entries = await getAllChangelogEntries();
  const filters = await searchParams;
  const stateFilter = pick(filters.state);
  const reviewFilter = pick(filters.review);

  const views: AdminChangelogView[] = entries
    .filter((entry) =>
      stateFilter === "draft"
        ? !entry.is_published
        : stateFilter === "published"
          ? entry.is_published
          : true,
    )
    // Both places a description can be waiting on a person: the cover's alt,
    // and a figure inside either body.
    .filter((entry) =>
      reviewFilter === "alt-unreviewed"
        ? entry.cover_alt_needs_review || entry.body_has_draft_alt
        : true,
    )
    .map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      title: locale === "ar" ? entry.title_ar : entry.title_en,
      isPublished: entry.is_published,
      dateLabel: entry.published_at ? formatDate(entry.published_at, locale) : null,
      // A draft still linked to a feature is one the system wrote on shipping.
      isAutoDraft: !entry.is_published && entry.feature_id !== null,
      hasUnreviewedAlt: entry.cover_alt_needs_review || entry.body_has_draft_alt,
    }))
    // Drafts first: they are the ones with work left on them.
    .sort((a, b) => Number(a.isPublished) - Number(b.isPublished));

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl/8 font-bold text-text">{dict.admin.changelog}</h1>
        <Link
          href={`/${locale}/admin/changelog/new`}
          className="inline-flex h-10 items-center gap-2 rounded-control bg-brand-solid px-4 text-sm font-semibold text-brand-solid-text shadow-sm transition-transform duration-(--dur-micro) hover:-translate-y-px"
        >
          <Plus className="size-4" strokeWidth={2} aria-hidden />
          {dict.admin.changelogNew}
        </Link>
      </div>

      <form method="get" className="mt-5 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-secondary">
          {dict.admin.filterState}
          <select name="state" defaultValue={stateFilter} className={FIELD_CLASS}>
            <option value="">{dict.admin.allStates}</option>
            <option value="draft">{dict.admin.stateDraft}</option>
            <option value="published">{dict.admin.statePublished}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-secondary">
          {dict.admin.filterReview}
          <select name="review" defaultValue={reviewFilter} className={FIELD_CLASS}>
            <option value="">{dict.admin.allReview}</option>
            <option value="alt-unreviewed">{dict.adminHelp.coverageAltUnreviewed}</option>
          </select>
        </label>
        <button type="submit" className="sr-only">
          {dict.admin.filterState}
        </button>
      </form>

      <AdminChangelogList entries={views} locale={locale} dict={dict} />
    </main>
  );
}
