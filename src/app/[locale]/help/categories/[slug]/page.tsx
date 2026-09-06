import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { Suspense } from "react";

import { ArticleSectionCard } from "@/components/help/ArticleSectionCard";
import { Breadcrumbs } from "@/components/help/Breadcrumbs";
import { CollectionIcon } from "@/components/help/CollectionIcon";
import { EscalationCard } from "@/components/help/EscalationCard";
import { HelpHeader } from "@/components/help/HelpHeader";
import { HelpShell } from "@/components/help/HelpShell";
import { JsonLd } from "@/components/help/JsonLd";
import { MissingTranslationNotice } from "@/components/help/MissingTranslationNotice";
import { SiteFooter } from "@/components/SiteFooter";
import { EmptyState } from "@/components/ui/EmptyState";
import { getDictionary } from "@/i18n";
import { LOCALES, isLocale, otherLocale } from "@/i18n/config";
import {
  getHelpArticlesInCollection,
  getHelpCollectionBySlug,
  getHelpCollections,
  getHelpNavigation,
} from "@/lib/data/help-repository";
import { articleCountLabel } from "@/lib/help/format";
import {
  decodeSlug,
  helpArticleHref,
  helpCollectionHref,
  helpFooterLinks,
  helpHomeHref,
} from "@/lib/help/paths";
import { siteUrl } from "@/lib/site";
import { followHelpRedirect, noteHelpNotFound } from "@/lib/help/redirects";
import { groupArticlesBySection } from "@/lib/help/sections";
import { breadcrumbJsonLd, helpOgImageUrl, helpRobots, helpSocialMetadata } from "@/lib/help/seo";

/**
 * P2 — one topic and its articles, grouped into a card per section with one
 * single-line row per article. Static with background regeneration.
 */
export const revalidate = 300;

export async function generateStaticParams() {
  const collections = await getHelpCollections();
  return LOCALES.flatMap((locale) =>
    collections.map((collection) => ({ locale, slug: collection.slug })),
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/help/categories/[slug]">): Promise<Metadata> {
  const { locale, slug: rawSlug } = await params;
  if (!isLocale(locale)) return {};
  const collection = await getHelpCollectionBySlug(decodeSlug(rawSlug));
  if (!collection) return {};

  const dict = getDictionary(locale);
  const name = locale === "ar" ? collection.name_ar : collection.name_en;
  const description = locale === "ar" ? collection.description_ar : collection.description_en;

  return {
    title: `${name} · ${dict.help.badge}`,
    description: description ?? dict.help.metaDescription,
    alternates: {
      canonical: helpCollectionHref(locale, collection.slug),
      languages: {
        ar: helpCollectionHref("ar", collection.slug),
        en: helpCollectionHref("en", collection.slug),
        "x-default": helpCollectionHref("ar", collection.slug),
      },
    },
    robots: helpRobots,
    ...helpSocialMetadata({
      locale,
      title: name,
      description: description ?? dict.help.metaDescription,
      url: helpCollectionHref(locale, collection.slug),
      image: helpOgImageUrl(locale, name, dict.help.badge, null),
      siteName: dict.help.name,
    }),
  };
}

export default async function HelpCategoryPage({
  params,
}: PageProps<"/[locale]/help/categories/[slug]">) {
  const { locale, slug: rawSlug } = await params;
  if (!isLocale(locale)) notFound();

  const slug = decodeSlug(rawSlug);
  const collection = await getHelpCollectionBySlug(slug);
  if (!collection) {
    const publicPath = `/${locale}/categories/${encodeURIComponent(slug)}`;
    const hit = await followHelpRedirect(locale, publicPath);
    if (hit) {
      if (hit.statusCode === 302) redirect(hit.href);
      permanentRedirect(hit.href);
    }
    await noteHelpNotFound(publicPath);
    notFound();
  }

  const dict = getDictionary(locale);
  const [articles, navigation] = await Promise.all([
    getHelpArticlesInCollection(collection.id, locale),
    getHelpNavigation(locale),
  ]);
  const active = { collectionId: collection.id, articleId: null };

  const name = locale === "ar" ? collection.name_ar : collection.name_en;
  const description = locale === "ar" ? collection.description_ar : collection.description_en;
  const sections = groupArticlesBySection(articles, dict.help.allArticles);
  const lastUpdated = articles.map((a) => a.updatedAt).sort().at(-1) ?? null;

  return (
    <>
      <a
        href="#help-category"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-control focus:bg-flovoo-navy focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {dict.nav.skipToContent}
      </a>

      <HelpHeader
        locale={locale}
        alternateHref={helpCollectionHref(otherLocale(locale), collection.slug)}
        collections={navigation}
        active={active}
      />

      <JsonLd
        data={breadcrumbJsonLd([
          { name: dict.help.breadcrumbHome, href: helpHomeHref(locale) },
          { name, href: helpCollectionHref(locale, collection.slug) },
        ])}
      />

      <HelpShell locale={locale} collections={navigation} active={active}>
        <main id="help-category" className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-3xl">
            <Breadcrumbs
              label={dict.help.breadcrumbLabel}
              items={[
                { label: dict.help.breadcrumbHome, href: helpHomeHref(locale) },
                { label: name },
              ]}
            />

            <div className="mt-6">
              <Suspense fallback={null}>
                <MissingTranslationNotice
                  title={dict.help.missingTranslationTitle}
                  body={dict.help.missingTranslationBody}
                />
              </Suspense>

              <header>
                <span className="inline-flex size-10 items-center justify-center rounded-control bg-info-tint text-link">
                  <CollectionIcon name={collection.icon} className="size-5" />
                </span>
                <h1 className="mt-3 text-2xl font-bold text-text">{name}</h1>
                {description ? (
                  <p className="mt-1 text-sm text-text-secondary">{description}</p>
                ) : null}
                <p className="mt-1.5 text-xs font-medium text-text-tertiary">
                  {articleCountLabel(dict, locale, articles.length)}
                </p>
              </header>

              {sections.length > 0 ? (
                <div className="mt-6 flex flex-col gap-4">
                  {sections.map((section) => (
                    <ArticleSectionCard
                      key={section.title}
                      section={section}
                      hrefFor={(slug) => helpArticleHref(locale, slug)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  className="mt-6"
                  title={dict.help.categoryEmptyTitle}
                  body={dict.help.categoryEmptyBody}
                />
              )}

              <div className="mt-10">
                <EscalationCard dict={dict} />
              </div>
            </div>
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
