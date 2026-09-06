import "server-only";

import { cache } from "react";

import { localHelpContent } from "@/lib/data/help-local-store";
import { getSupabase } from "@/lib/data/supabase";
import type {
  HelpArticle,
  HelpArticleDetail,
  HelpArticleSummary,
  HelpArticleTranslation,
  HelpCollection,
  HelpCollectionWithCount,
  HelpNavCollection,
  HelpSearchDocument,
} from "@/lib/help/types";
import { otherLocale } from "@/i18n/config";
import type { Locale } from "@/lib/types";

/**
 * The single read path for the public help center. Anon key when Supabase is
 * configured, the seed otherwise — the pages never know which.
 *
 * Everything public derives from one snapshot of the published content, loaded
 * once per request. A help center has hundreds of articles at most, so one
 * round trip per table and composing in memory is both simpler and faster than
 * a bespoke query per page — and it guarantees the home page, a category and
 * an article can never disagree about what is published.
 */

interface PublishedContent {
  collections: HelpCollection[];
  articles: HelpArticle[];
  translations: HelpArticleTranslation[];
}

const loadPublished = cache(async (): Promise<PublishedContent> => {
  const supabase = getSupabase();

  if (!supabase) {
    // The seed plus every admin edit made in this process — the same snapshot
    // the admin repository reads, so the two sides never disagree.
    const local = localHelpContent();
    const collections = local.collections.filter((c) => c.is_published);
    const collectionIds = new Set(collections.map((c) => c.id));
    const articles = local.articles.filter(
      (a) => a.status === "published" && collectionIds.has(a.collection_id),
    );
    const articleIds = new Set(articles.map((a) => a.id));
    return {
      collections: [...collections].sort(byCollectionOrder),
      articles,
      translations: local.translations.filter((t) => articleIds.has(t.article_id)),
    };
  }

  // RLS already limits the anon role to published rows; the filters are
  // repeated here so the intent is visible and the service key would behave
  // the same way.
  const [collectionsResult, articlesResult] = await Promise.all([
    supabase
      .from("help_collections")
      .select("*")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
    supabase.from("help_articles").select("*").eq("status", "published"),
  ]);
  if (collectionsResult.error) {
    throw new Error(`Failed to load help collections: ${collectionsResult.error.message}`);
  }
  if (articlesResult.error) {
    throw new Error(`Failed to load help articles: ${articlesResult.error.message}`);
  }

  const collections = collectionsResult.data as HelpCollection[];
  const collectionIds = new Set(collections.map((c) => c.id));
  const articles = (articlesResult.data as HelpArticle[]).filter((a) =>
    collectionIds.has(a.collection_id),
  );

  if (articles.length === 0) return { collections, articles, translations: [] };

  const translationsResult = await supabase
    .from("help_article_translations")
    .select("*")
    .in(
      "article_id",
      articles.map((a) => a.id),
    );
  if (translationsResult.error) {
    throw new Error(
      `Failed to load help translations: ${translationsResult.error.message}`,
    );
  }

  return {
    collections,
    articles,
    translations: translationsResult.data as HelpArticleTranslation[],
  };
});

function byCollectionOrder(a: HelpCollection, b: HelpCollection): number {
  return a.sort_order - b.sort_order || a.name_en.localeCompare(b.name_en);
}

/** Editorial order inside a collection, then alphabetical in the reader's language. */
function byArticleOrder(locale: Locale) {
  return (a: HelpArticleSummary, b: HelpArticleSummary): number =>
    a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, locale);
}

function toSummary(
  translation: HelpArticleTranslation,
  article: HelpArticle,
  collection: HelpCollection,
): HelpArticleSummary {
  return {
    id: article.id,
    slug: translation.slug,
    title: translation.title,
    excerpt: translation.excerpt,
    readingMinutes: translation.reading_minutes,
    icon: article.icon,
    isPinned: article.is_pinned,
    sortOrder: article.sort_order,
    section:
      (translation.language === "ar" ? article.section_ar : article.section_en) ?? null,
    // The later of the two: a body edit or a status change both count.
    updatedAt:
      translation.updated_at > article.updated_at ? translation.updated_at : article.updated_at,
    collection,
  };
}

/** Every published article that has a translation in `locale`, as summaries. */
const summariesFor = cache(async (locale: Locale): Promise<HelpArticleSummary[]> => {
  const { collections, articles, translations } = await loadPublished();
  const collectionById = new Map(collections.map((c) => [c.id, c]));
  const articleById = new Map(articles.map((a) => [a.id, a]));

  const summaries: HelpArticleSummary[] = [];
  for (const translation of translations) {
    if (translation.language !== locale) continue;
    const article = articleById.get(translation.article_id);
    const collection = article && collectionById.get(article.collection_id);
    if (!article || !collection) continue;
    summaries.push(toSummary(translation, article, collection));
  }
  return summaries.sort(byArticleOrder(locale));
});

export async function getHelpCollections(): Promise<HelpCollection[]> {
  return (await loadPublished()).collections;
}

export async function getHelpCollectionsWithCounts(
  locale: Locale,
): Promise<HelpCollectionWithCount[]> {
  const [collections, summaries] = await Promise.all([
    getHelpCollections(),
    summariesFor(locale),
  ]);
  const counts = new Map<string, number>();
  for (const summary of summaries) {
    counts.set(summary.collection.id, (counts.get(summary.collection.id) ?? 0) + 1);
  }
  return collections.map((collection) => ({
    ...collection,
    articleCount: counts.get(collection.id) ?? 0,
  }));
}

export async function getHelpCollectionBySlug(slug: string): Promise<HelpCollection | null> {
  const collections = await getHelpCollections();
  return collections.find((c) => c.slug === slug) ?? null;
}

/** "Most read" on the home page: what the team pinned, in editorial order. */
export async function getPinnedHelpArticles(
  locale: Locale,
  limit = 6,
): Promise<HelpArticleSummary[]> {
  const summaries = await summariesFor(locale);
  return summaries.filter((s) => s.isPinned).slice(0, limit);
}

export async function getHelpArticlesInCollection(
  collectionId: string,
  locale: Locale,
): Promise<HelpArticleSummary[]> {
  const summaries = await summariesFor(locale);
  return summaries.filter((s) => s.collection.id === collectionId);
}

/** Slugs to prerender, one per published translation in `locale`. */
export async function getHelpArticleSlugs(locale: Locale): Promise<string[]> {
  return (await summariesFor(locale)).map((s) => s.slug);
}

/**
 * Every published article in one language, with its body — one pass over the
 * snapshot, no per-article work.
 *
 * `getHelpArticleBySlug` resolves siblings and the other language for each
 * call, which is right for a page and quadratic for an export: building
 * `llms-full.txt` article by article took long enough to time out. This is
 * what the export and the Markdown corpus read.
 */
export async function getPublishedArticlesForExport(
  locale: Locale,
): Promise<
  {
    slug: string;
    title: string;
    excerpt: string | null;
    body: HelpArticleTranslation["body"];
    updatedAt: string;
    collectionName: string;
    collectionSlug: string;
  }[]
> {
  const { collections, articles, translations } = await loadPublished();
  const articleById = new Map(articles.map((a) => [a.id, a]));
  const collectionById = new Map(collections.map((c) => [c.id, c]));

  return translations
    .filter((t) => t.language === locale)
    .flatMap((translation) => {
      const article = articleById.get(translation.article_id);
      const collection = article && collectionById.get(article.collection_id);
      if (!article || !collection) return [];
      return [
        {
          slug: translation.slug,
          title: translation.title,
          excerpt: translation.excerpt,
          body: translation.body,
          updatedAt: article.updated_at,
          collectionName: locale === "ar" ? collection.name_ar : collection.name_en,
          collectionSlug: collection.slug,
        },
      ];
    })
    .sort((a, b) => a.collectionSlug.localeCompare(b.collectionSlug) || a.title.localeCompare(b.title));
}

export async function getHelpArticleBySlug(
  locale: Locale,
  slug: string,
): Promise<HelpArticleDetail | null> {
  const { collections, articles, translations } = await loadPublished();

  const translation = translations.find((t) => t.language === locale && t.slug === slug);
  if (!translation) return null;
  const article = articles.find((a) => a.id === translation.article_id);
  const collection = article && collections.find((c) => c.id === article.collection_id);
  if (!article || !collection) return null;

  const other = otherLocale(locale);
  const counterpart = translations.find(
    (t) => t.article_id === article.id && t.language === other,
  );

  const siblings = await getHelpArticlesInCollection(collection.id, locale);
  const index = siblings.findIndex((s) => s.id === article.id);
  const neighbour = (s: HelpArticleSummary | undefined) =>
    s ? { slug: s.slug, title: s.title } : null;

  return {
    ...toSummary(translation, article, collection),
    body: translation.body,
    toc: translation.toc,
    publishedAt: article.published_at,
    metaTitle: translation.meta_title,
    metaDescription: translation.meta_description,
    ogImagePath: translation.og_image_path,
    answerSummary: translation.answer_summary,
    questionTitle: translation.question_title,
    keyFacts: Array.isArray(translation.key_facts) ? translation.key_facts : [],
    alternate: counterpart ? { locale: other, slug: counterpart.slug } : null,
    previous: index > 0 ? neighbour(siblings[index - 1]) : null,
    next: index >= 0 ? neighbour(siblings[index + 1]) : null,
  };
}

/**
 * The sidebar's tree: published topics in order, each with the articles that
 * exist in `locale`. Topics with nothing to read in this language are left
 * out — an empty branch is a dead end, not navigation.
 */
export async function getHelpNavigation(locale: Locale): Promise<HelpNavCollection[]> {
  const [collections, summaries] = await Promise.all([
    getHelpCollections(),
    summariesFor(locale),
  ]);
  return collections
    .map((collection) => ({
      id: collection.id,
      slug: collection.slug,
      name: locale === "ar" ? collection.name_ar : collection.name_en,
      icon: collection.icon,
      articles: summaries
        .filter((s) => s.collection.id === collection.id)
        .map((s) => ({ id: s.id, slug: s.slug, title: s.title, icon: s.icon })),
    }))
    .filter((collection) => collection.articles.length > 0);
}

/**
 * Every published translation in `locale` with the text search ranks on. The
 * seed-backed search reads this directly; with Supabase the ranking happens in
 * `help_search()` and this is only used to shape its rows.
 */
export const getHelpSearchCorpus = cache(async (locale: Locale): Promise<HelpSearchDocument[]> => {
  const { collections, articles, translations } = await loadPublished();
  const collectionById = new Map(collections.map((c) => [c.id, c]));
  const articleById = new Map(articles.map((a) => [a.id, a]));

  const documents: HelpSearchDocument[] = [];
  for (const translation of translations) {
    if (translation.language !== locale) continue;
    const article = articleById.get(translation.article_id);
    const collection = article && collectionById.get(article.collection_id);
    if (!article || !collection) continue;
    documents.push({
      id: article.id,
      slug: translation.slug,
      title: translation.title,
      excerpt: translation.excerpt,
      bodyPlain: translation.body_plain,
      collection: {
        id: collection.id,
        slug: collection.slug,
        name: locale === "ar" ? collection.name_ar : collection.name_en,
      },
    });
  }
  return documents;
});

/** The most recent change across everything published, for the footer. */
export async function getHelpLastUpdated(locale: Locale): Promise<string | null> {
  const summaries = await summariesFor(locale);
  return summaries.map((s) => s.updatedAt).sort().at(-1) ?? null;
}
