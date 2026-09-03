import { Suspense } from "react";
import { notFound } from "next/navigation";

import { PageHeading } from "@/components/PageHeading";
import { BoardSkeleton } from "@/components/roadmap/BoardSkeleton";
import { RoadmapBoard } from "@/components/roadmap/RoadmapBoard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getCurrentUser, isSupabaseAuthConfigured } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/admin";
import { readClock } from "@/lib/clock";
import {
  getBoardFeatures,
  getCategories,
  getFollowedFeatureIds,
  getVotedFeatureIds,
} from "@/lib/data/repository";
import { toFeatureView } from "@/lib/view";

/**
 * The board is rendered per request rather than prerendered: vote counts move,
 * and which items *this* person voted for or follows is theirs alone. Resolving
 * the session is what opts the route into dynamic rendering, which is the
 * correct trade for personalised content.
 */
/** Live vote counts and a per-person session; never prerendered. */
export const dynamic = "force-dynamic";

export default async function RoadmapPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  const admin = await isAdmin(user);

  const [features, categories, votedIds, followedIds] = await Promise.all([
    getBoardFeatures(),
    getCategories(),
    getVotedFeatureIds(user?.id ?? null),
    getFollowedFeatureIds(user?.id ?? null),
  ]);

  // One clock reading for the whole render, so "New" badges can't disagree.
  const now = readClock();
  const views = features.map((feature) =>
    toFeatureView(feature, locale, now, votedIds, followedIds),
  );

  const categoryOptions = categories.map((category) => ({
    slug: category.slug,
    name: locale === "ar" ? category.name_ar : category.name_en,
    color: category.color,
  }));

  const lastUpdated =
    features
      .map((feature) => feature.updated_at)
      .sort()
      .at(-1) ?? null;

  return (
    <>
      <a
        href="#board"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-control focus:bg-flovoo-navy focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {dict.nav.skipToContent}
      </a>

      <SiteHeader
        locale={locale}
        categories={categoryOptions}
        user={user}
        isAdmin={admin}
        googleEnabled={isSupabaseAuthConfigured}
      />

      <main
        id="board"
        className="mx-auto w-full max-w-board px-5 py-8 lg:px-10 lg:py-10"
      >
        <Suspense fallback={<BoardSkeleton />}>
          <RoadmapBoard
            heading={
              <PageHeading title={dict.site.title} subtitle={dict.site.tagline} />
            }
            features={views}
            categories={categoryOptions}
            dict={dict}
            locale={locale}
            googleEnabled={isSupabaseAuthConfigured}
          />
        </Suspense>
      </main>

      <SiteFooter locale={locale} updatedAt={lastUpdated} />
    </>
  );
}
