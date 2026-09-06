import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleListItem } from "@/components/help/ArticleListItem";
import { CollectionCard } from "@/components/help/CollectionCard";
import { EscalationCard } from "@/components/help/EscalationCard";
import { HelpHeader } from "@/components/help/HelpHeader";
import { HelpSearch } from "@/components/help/HelpSearch";
import { HelpShell } from "@/components/help/HelpShell";
import { JsonLd } from "@/components/help/JsonLd";
import { SiteFooter } from "@/components/SiteFooter";
import { getDictionary } from "@/i18n";
import { isLocale, otherLocale } from "@/i18n/config";
import {
  getHelpCollectionsWithCounts,
  getHelpLastUpdated,
  getHelpNavigation,
  getPinnedHelpArticles,
} from "@/lib/data/help-repository";
import { helpSearchLabels } from "@/lib/help/labels";
import { articleCountLabel, readingTimeLabel } from "@/lib/help/format";
import {
  helpArticleHref,
  helpCollectionHref,
  helpFooterLinks,
  helpHomeHref,
  helpSearchHref,
} from "@/lib/help/paths";
import { helpOgImageUrl, helpRobots,
  helpSocialMetadata, websiteJsonLd } from "@/lib/help/seo";
import { siteUrl } from "@/lib/site";

/**
 * P1 — the help center home. Static, regenerated in the background at most
 * every five minutes: nothing here is personal, and a published article should
 * be findable within minutes without a deploy. Phase 3 adds on-demand
 * revalidation from the admin so it is seconds instead.
 */
export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/help">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: { absolute: dict.help.name },
    description: dict.help.metaDescription,
    alternates: {
      canonical: helpHomeHref(locale),
      languages: {
        ar: helpHomeHref("ar"),
        en: helpHomeHref("en"),
        "x-default": helpHomeHref("ar"),
      },
    },
    robots: helpRobots,
    ...helpSocialMetadata({
      locale,
      title: dict.help.name,
      description: dict.help.metaDescription,
      url: helpHomeHref(locale),
      image: helpOgImageUrl(locale, dict.help.heroTitle, dict.help.heroSubtitle, null),
      siteName: dict.help.name,
    }),
  };
}

export default async function HelpHomePage({ params }: PageProps<"/[locale]/help">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const [collections, pinned, lastUpdated, navigation] = await Promise.all([
    getHelpCollectionsWithCounts(locale),
    getPinnedHelpArticles(locale),
    getHelpLastUpdated(locale),
    getHelpNavigation(locale),
  ]);
  const active = { collectionId: null, articleId: null };

  return (
    <>
      <a
        href="#help-home"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-control focus:bg-flovoo-navy focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {dict.nav.skipToContent}
      </a>

      <HelpHeader
        locale={locale}
        alternateHref={helpHomeHref(otherLocale(locale))}
        collections={navigation}
        active={active}
        showSearch={false}
      />

      <JsonLd data={websiteJsonLd(locale, dict)} />

      <HelpShell locale={locale} collections={navigation} active={active}>
        <main id="help-home" className="flex-1 px-4 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
            {/* Hero: one title, one line, one search field. */}
            <section className="text-center">
              <h1 className="text-2xl font-bold text-text lg:text-[2rem] lg:leading-tight">
                {dict.help.heroTitle}
              </h1>
              <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary lg:text-base">
                {dict.help.heroSubtitle}
              </p>
              <HelpSearch
                locale={locale}
                variant="hero"
                action={helpSearchHref(locale)}
                labels={helpSearchLabels(dict)}
                className="mx-auto mt-6 max-w-xl"
              />
            </section>

            {/* No published topics is a real state — during a content migration,
                or before the first topic goes live. A heading over nothing
                reads as a broken page, so the section goes with its content. */}
            {collections.length > 0 ? (
            <section aria-labelledby="help-browse-title">
              <h2 id="help-browse-title" className="mb-3 text-base font-bold text-text">
                {dict.help.browseTitle}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {collections.map((collection) => (
                  <li key={collection.id}>
                    <CollectionCard
                      href={helpCollectionHref(locale, collection.slug)}
                      name={locale === "ar" ? collection.name_ar : collection.name_en}
                      description={
                        locale === "ar" ? collection.description_ar : collection.description_en
                      }
                      icon={collection.icon}
                      countLabel={articleCountLabel(dict, locale, collection.articleCount)}
                    />
                  </li>
                ))}
              </ul>
            </section>
            ) : null}

            {pinned.length > 0 ? (
              <section aria-labelledby="help-popular-title">
                <h2 id="help-popular-title" className="mb-3 text-base font-bold text-text">
                  {dict.help.popularTitle}
                </h2>
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {pinned.map((article) => (
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

            <EscalationCard dict={dict} />
          </div>
        </main>
      </HelpShell>

      <SiteFooter
        locale={locale}
        updatedAt={lastUpdated}
        links={helpFooterLinks(locale, siteUrl(), {
          about: dict.help.aboutTitle,
          glossary: dict.help.glossaryTitle,
          roadmap: dict.help.roadmapLink,
          updates: dict.nav.updates,
        })}
      />
    </>
  );
}
