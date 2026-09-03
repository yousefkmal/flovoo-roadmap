import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import {
  AdminChangelogList,
  type AdminChangelogView,
} from "@/components/admin/ChangelogList";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getAllChangelogEntries } from "@/lib/data/admin-repository";
import { formatDate } from "@/lib/format";

export default async function AdminChangelogPage({
  params,
}: PageProps<"/[locale]/admin/changelog">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const entries = await getAllChangelogEntries();

  const views: AdminChangelogView[] = entries
    .map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      title: locale === "ar" ? entry.title_ar : entry.title_en,
      isPublished: entry.is_published,
      dateLabel: entry.published_at ? formatDate(entry.published_at, locale) : null,
      // A draft still linked to a feature is one the system wrote on shipping.
      isAutoDraft: !entry.is_published && entry.feature_id !== null,
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

      <AdminChangelogList entries={views} locale={locale} dict={dict} />
    </main>
  );
}
