import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeading } from "@/components/PageHeading";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import {
  ChangelogList,
  type ChangelogEntryView,
} from "@/components/updates/ChangelogList";
import { SubscribeButton } from "@/components/updates/SubscribeButton";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getCurrentUser, isSupabaseAuthConfigured } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/admin";
import {
  getCategories,
  getPublishedChangelog,
  getReactions,
  getShippedFeatures,
} from "@/lib/data/repository";
import { formatDate } from "@/lib/format";
import { isSafeHttpUrl } from "@/lib/validation";

/** Reactions are live and the subscribe state is per-person; never prerendered. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/updates">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.updates.title,
    description: dict.updates.metaDescription,
    alternates: {
      canonical: `/${locale}/updates`,
      languages: { ar: "/ar/updates", en: "/en/updates" },
      types: { "application/rss+xml": `/${locale}/updates/feed.xml` },
    },
  };
}

export default async function UpdatesPage({ params }: PageProps<"/[locale]/updates">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  const admin = await isAdmin(user);

  const [entries, shipped, categories] = await Promise.all([
    getPublishedChangelog(),
    getShippedFeatures(),
    getCategories(),
  ]);

  const reactions = await getReactions(
    entries.map((entry) => entry.id),
    user?.id ?? null,
  );

  // An entry inherits its category from the feature it announces.
  const categoryByFeature = new Map(
    shipped.map((feature) => [
      feature.id,
      feature.category
        ? locale === "ar"
          ? feature.category.name_ar
          : feature.category.name_en
        : null,
    ]),
  );

  const views: ChangelogEntryView[] = entries
    .filter((entry) => entry.published_at)
    .map((entry) => {
      const title = locale === "ar" ? entry.title_ar : entry.title_en;
      const body = (locale === "ar" ? entry.body_ar : entry.body_en) ?? "";
      const alt = locale === "ar" ? entry.image_alt_ar : entry.image_alt_en;
      const actionLabel =
        (locale === "ar" ? entry.action_label_ar : entry.action_label_en) ??
        dict.updates.exploreNow;

      return {
        id: entry.id,
        kind: entry.kind,
        title,
        // Bodies are stored as plain text with blank lines between paragraphs;
        // splitting here keeps the renderer free of any HTML from the database.
        paragraphs: body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
        dateLabel: formatDate(entry.published_at!, locale),
        dateTime: entry.published_at!,
        imageUrl: entry.image_url,
        // Falling back to the title is better than an empty alt on an image
        // that carries meaning.
        imageAlt: alt ?? title,
        categoryName: entry.feature_id
          ? (categoryByFeature.get(entry.feature_id) ?? null)
          : null,
        // Checked again on the way out: a stored URL becomes an href, and a
        // `javascript:` one would run.
        articleUrl: isSafeHttpUrl(entry.article_url) ? entry.article_url : null,
        actionUrl: isSafeHttpUrl(entry.action_url) ? entry.action_url : null,
        actionLabel,
        reactions: reactions.get(entry.id) ?? [],
        haystack: `${title} ${body}`.toLowerCase(),
      };
    });

  const categoryOptions = categories.map((category) => ({
    slug: category.slug,
    name: locale === "ar" ? category.name_ar : category.name_en,
  }));

  const lastPublished = entries[0]?.published_at ?? null;

  return (
    <>
      <a
        href="#updates"
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
        id="updates"
        className="mx-auto w-full max-w-4xl px-5 py-10 lg:px-10 lg:py-14"
      >
        <PageHeading
          title={dict.updates.title}
          subtitle={dict.updates.subtitle}
          size="changelog"
        />

        <SubscribeButton
          scope={user?.notifyScope ?? null}
          signedIn={Boolean(user)}
          locale={locale}
          dict={dict}
          googleEnabled={isSupabaseAuthConfigured}
          feedHref={`/${locale}/updates/feed.xml`}
        />

        <ChangelogList
          entries={views}
          locale={locale}
          dict={dict}
          googleEnabled={isSupabaseAuthConfigured}
        />
      </main>

      <SiteFooter locale={locale} updatedAt={lastPublished} />
    </>
  );
}
