import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import { AdminBoard, type AdminFeatureView } from "@/components/admin/AdminBoard";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { StatsHeader } from "@/components/admin/StatsHeader";
import {
  ADMIN_STATUSES,
  getAdminStats,
  getAllFeatures,
} from "@/lib/data/admin-repository";

export default async function AdminBoardPage({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const features = await getAllFeatures();
  const stats = await getAdminStats(features);

  const views: AdminFeatureView[] = features.map((feature) => ({
    id: feature.id,
    title: locale === "ar" ? feature.title_ar : feature.title_en,
    status: feature.status,
    votes: feature.vote_count,
    isPinned: feature.is_pinned,
    categoryName: feature.category
      ? locale === "ar"
        ? feature.category.name_ar
        : feature.category.name_en
      : null,
    categoryColor: feature.category?.color ?? null,
  }));

  return (
    <main className="mx-auto w-full max-w-board px-5 py-8 lg:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl/8 font-bold text-text">{dict.admin.board}</h1>
        </div>

        <Link
          href={`/${locale}/admin/features/new`}
          className="inline-flex h-10 items-center gap-2 rounded-control bg-brand-solid px-4 text-sm font-semibold text-brand-solid-text shadow-sm transition-transform duration-(--dur-micro) hover:-translate-y-px"
        >
          <Plus className="size-4" strokeWidth={2} aria-hidden />
          {dict.admin.newFeature}
        </Link>
      </div>

      <StatsHeader stats={stats} locale={locale} dict={dict} />

      <AdminBoard
        statuses={ADMIN_STATUSES}
        features={views}
        locale={locale}
        dict={dict}
      />
    </main>
  );
}
