import type { MetadataRoute } from "next";

import { LOCALES } from "@/i18n/config";
import {
  getHelpArticleSlugs,
  getHelpCollections,
  getHelpArticleBySlug,
} from "@/lib/data/help-repository";
import { helpArticleHref, helpCollectionHref, helpHomeHref } from "@/lib/help/paths";
import { absoluteUrl } from "@/lib/help/seo";
import { isLocale } from "@/i18n/config";

/**
 * One sitemap per language (brief §8.6): `/sitemap/ar.xml` and
 * `/sitemap/en.xml`, both listed in robots.txt. Every entry carries its
 * hreflang pair so a crawler learns the counterpart from the sitemap alone.
 * Regenerated at most every five minutes and on publish.
 */
export const revalidate = 300;

export async function generateSitemaps() {
  return LOCALES.map((locale) => ({ id: locale }));
}

/**
 * `ar`, `en` and `x-default` for one page.
 *
 * `x-default` was missing from every entry — it is what tells a search engine
 * which version to serve a reader whose language matches neither, and Arabic is
 * the product default. The website's sitemap already emitted it on all 80 URLs;
 * this is the help center catching up.
 */
function withDefault(ar: string, en: string): Record<string, string> {
  return { ar, en, "x-default": ar };
}

export default async function sitemap({ id }: { id: string }): Promise<MetadataRoute.Sitemap> {
  const locale = isLocale(id) ? id : "ar";
  const other = locale === "ar" ? "en" : "ar";

  const [collections, slugs] = await Promise.all([
    getHelpCollections(),
    getHelpArticleSlugs(locale),
  ]);

  const entries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl(`${helpHomeHref(locale)}/about`),
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages: withDefault(absoluteUrl(`${helpHomeHref("ar")}/about`), absoluteUrl(`${helpHomeHref("en")}/about`)) },
    },
    {
      url: absoluteUrl(`${helpHomeHref(locale)}/glossary`),
      changeFrequency: "weekly",
      priority: 0.5,
      alternates: { languages: withDefault(absoluteUrl(`${helpHomeHref("ar")}/glossary`), absoluteUrl(`${helpHomeHref("en")}/glossary`)) },
    },
    {
      url: absoluteUrl(helpHomeHref(locale)),
      changeFrequency: "daily",
      priority: 1,
      alternates: {
        languages: withDefault(absoluteUrl(helpHomeHref("ar")), absoluteUrl(helpHomeHref("en"))),
      },
    },
    ...collections.map((collection) => ({
      url: absoluteUrl(helpCollectionHref(locale, collection.slug)),
      lastModified: collection.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      alternates: {
        languages: withDefault(
          absoluteUrl(helpCollectionHref("ar", collection.slug)),
          absoluteUrl(helpCollectionHref("en", collection.slug)),
        ),
      },
    })),
  ];

  for (const slug of slugs) {
    const article = await getHelpArticleBySlug(locale, slug);
    if (!article) continue;
    const languages: Record<string, string> = {
      [locale]: absoluteUrl(helpArticleHref(locale, slug)),
    };
    if (article.alternate) {
      languages[other] = absoluteUrl(helpArticleHref(other, article.alternate.slug));
    }
    // Arabic is the product default, so it is what a reader whose language
    // matches neither should be shown.
    languages["x-default"] = languages.ar ?? absoluteUrl(helpArticleHref(locale, slug));
    entries.push({
      url: absoluteUrl(helpArticleHref(locale, slug)),
      lastModified: article.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: { languages },
    });
  }

  // The roadmap lives on the same app; its two public pages belong here too.
  entries.push(
    { url: absoluteUrl(`/${locale}`), changeFrequency: "daily", priority: 0.6 },
    { url: absoluteUrl(`/${locale}/updates`), changeFrequency: "weekly", priority: 0.6 },
  );

  return entries;
}
