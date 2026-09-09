import "server-only";

import { localHelpContent, localMedia, localNotFound, localRedirects } from "@/lib/data/help-local-store";
import { getServiceSupabase } from "@/lib/data/supabase-admin";
import type {
  HelpAdminArticle,
  HelpAdminArticleRow,
  HelpArticle,
  HelpArticleTranslation,
  HelpCollection,
  HelpMedia,
  HelpRedirect,
} from "@/lib/help/types";
import { contentScore, runContentChecks } from "@/lib/help/content-checks";
import { helpContentSnapshot } from "@/lib/help/content-snapshot";
import type { Locale } from "@/lib/types";

/**
 * Reads for the help center's admin side. Service role, so drafts, archived
 * articles and unpublished topics are all visible — none of which the public
 * repository can return by accident. Without Supabase everything comes from
 * the same local snapshot the public side reads.
 */

export async function getAdminHelpCollections(): Promise<HelpCollection[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return localHelpContent().collections;

  const { data, error } = await supabase
    .from("help_collections")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Failed to load help collections: ${error.message}`);
  return data as HelpCollection[];
}

/** Articles per collection, all statuses — what decides whether a topic may be deleted. */
export async function getHelpCollectionArticleCounts(): Promise<Map<string, number>> {
  const articles = await allArticles();
  const counts = new Map<string, number>();
  for (const a of articles) counts.set(a.collection_id, (counts.get(a.collection_id) ?? 0) + 1);
  return counts;
}

async function allArticles(): Promise<HelpArticle[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return localHelpContent().articles;
  const { data, error } = await supabase.from("help_articles").select("*");
  if (error) throw new Error(`Failed to load help articles: ${error.message}`);
  return data as HelpArticle[];
}

type TranslationHead = Pick<
  HelpArticleTranslation,
  "id" | "article_id" | "language" | "slug" | "title" | "updated_at"
> & {
  /**
   * The body and the meta fields come along because the list shows a readiness
   * score, and that score cannot be computed without reading the article. It
   * costs a megabyte or so across seventy articles — the media page already
   * loads every body for its usage count — and it buys a column that tells an
   * editor where to spend the afternoon.
   */
  body?: HelpArticleTranslation["body"];
  meta_title?: string | null;
  meta_description?: string | null;
  question_title?: string | null;
  key_facts?: string[];
  /** Generated column (migration 0014). Absent from the local store's rows. */
  has_draft_alt?: boolean;
  answer_summary?: string | null;
  summary_needs_review?: boolean;
  review_due_at?: string | null;
};

/** The same thing migration 0014's generated column computes, for the local store. */
function bodyHasDraftAlt(node: { attrs?: Record<string, unknown>; content?: unknown[] }): boolean {
  if (node?.attrs?.altDraft === true) return true;
  return (node?.content ?? []).some((child) =>
    bodyHasDraftAlt(child as { attrs?: Record<string, unknown>; content?: unknown[] }),
  );
}

async function translationHeads(): Promise<TranslationHead[]> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return localHelpContent().translations.map((t) => ({
      ...t,
      has_draft_alt: bodyHasDraftAlt(t.body),
    }));
  }
  const { data, error } = await supabase
    .from("help_article_translations")
    .select(
      "id, article_id, language, slug, title, updated_at, has_draft_alt, answer_summary, summary_needs_review, review_due_at, meta_title, meta_description, question_title, key_facts, body",
    );
  if (error) throw new Error(`Failed to load help translations: ${error.message}`);
  return data as TranslationHead[];
}

/** The same score the editor's panel shows, for one translation in the list. */
function readinessOf(
  head: TranslationHead | undefined,
  language: Locale,
  hasOtherLanguage: boolean,
  articleUpdatedAt: string,
): number | null {
  if (!head?.body) return null;
  return contentScore(
    runContentChecks(
      helpContentSnapshot({
        language,
        title: head.title,
        metaTitle: head.meta_title ?? null,
        metaDescription: head.meta_description ?? null,
        answerSummary: head.answer_summary ?? null,
        questionTitle: head.question_title ?? null,
        keyFacts: Array.isArray(head.key_facts) ? head.key_facts : [],
        body: head.body,
        hasOtherLanguage,
        updatedAt: head.updated_at ?? articleUpdatedAt,
        reviewDueAt: head.review_due_at ?? null,
      }),
    ),
  );
}

/** The articles list: newest edit first, each with whatever translations it has. */
export async function getAdminHelpArticles(): Promise<HelpAdminArticleRow[]> {
  const [collections, articles, heads] = await Promise.all([
    getAdminHelpCollections(),
    allArticles(),
    translationHeads(),
  ]);
  const collectionById = new Map(collections.map((c) => [c.id, c]));
  const headsByArticle = new Map<string, Partial<Record<Locale, TranslationHead>>>();
  for (const head of heads) {
    const entry = headsByArticle.get(head.article_id) ?? {};
    entry[head.language] = head;
    headsByArticle.set(head.article_id, entry);
  }

  return articles
    .flatMap((article) => {
      const collection = collectionById.get(article.collection_id);
      if (!collection) return [];
      const t = headsByArticle.get(article.id) ?? {};
      const earliestReview =
        [t.ar?.review_due_at, t.en?.review_due_at]
          .filter((v): v is string => Boolean(v))
          .sort()[0] ?? null;
      const updatedAt = [article.updated_at, t.ar?.updated_at, t.en?.updated_at]
        .filter((v): v is string => Boolean(v))
        .sort()
        .at(-1)!;
      return [
        {
          id: article.id,
          status: article.status,
          isPinned: article.is_pinned,
          sortOrder: article.sort_order,
          icon: article.icon,
          section:
            article.section_ar && article.section_en
              ? { ar: article.section_ar, en: article.section_en }
              : null,
          collection: {
            id: collection.id,
            slug: collection.slug,
            name_ar: collection.name_ar,
            name_en: collection.name_en,
          },
          ar: t.ar ? { slug: t.ar.slug, title: t.ar.title } : null,
          en: t.en ? { slug: t.en.slug, title: t.en.title } : null,
          updatedAt,
          publishedAt: article.published_at,
          hasDraftAlt: Boolean(t.ar?.has_draft_alt || t.en?.has_draft_alt),
          readiness: {
            ar: readinessOf(t.ar, "ar", Boolean(t.en), article.updated_at),
            en: readinessOf(t.en, "en", Boolean(t.ar), article.updated_at),
          },
          // An unreviewed draft counts as no summary, so one filter answers
          // "which articles still need me?" whether the field is empty or
          // holds text nobody has read.
          needsSummary: (["ar", "en"] as const).some(
            (language) =>
              t[language] &&
              (!String(t[language]?.answer_summary ?? "").trim() ||
                t[language]?.summary_needs_review === true),
          ),
          summaryUnreviewed: (["ar", "en"] as const).some(
            (language) => t[language]?.summary_needs_review === true,
          ),
          reviewDueAt: earliestReview,
          // Decided here rather than in the page: `Date.now()` during render is
          // exactly the impurity this codebase has been bitten by before.
          reviewDue: Boolean(earliestReview && Date.parse(earliestReview) <= Date.now()),
        },
      ];
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getAdminHelpArticle(id: string): Promise<HelpAdminArticle | null> {
  const supabase = getServiceSupabase();

  if (!supabase) {
    const local = localHelpContent();
    const article = local.articles.find((a) => a.id === id);
    if (!article) return null;
    const translations: HelpAdminArticle["translations"] = {};
    for (const t of local.translations) if (t.article_id === id) translations[t.language] = t;
    return { article, translations };
  }

  const [articleResult, translationsResult] = await Promise.all([
    supabase.from("help_articles").select("*").eq("id", id).maybeSingle(),
    supabase.from("help_article_translations").select("*").eq("article_id", id),
  ]);
  if (articleResult.error) throw new Error(`Failed to load article: ${articleResult.error.message}`);
  if (translationsResult.error) {
    throw new Error(`Failed to load translations: ${translationsResult.error.message}`);
  }
  if (!articleResult.data) return null;

  const translations: HelpAdminArticle["translations"] = {};
  for (const t of translationsResult.data as HelpArticleTranslation[]) translations[t.language] = t;
  return { article: articleResult.data as HelpArticle, translations };
}

export interface HelpMediaWithUsage extends HelpMedia {
  /** How many translations reference the file in a figure. */
  usageCount: number;
}

/**
 * The media library, newest first, with how many article bodies reference
 * each file. Bodies are scanned as text here rather than in SQL: a help center
 * has tens of articles, and this keeps the query trivial.
 */
export async function getAdminHelpMedia(): Promise<HelpMediaWithUsage[]> {
  const supabase = getServiceSupabase();

  let media: HelpMedia[];
  let bodies: string[];
  if (!supabase) {
    media = localMedia();
    bodies = localHelpContent().translations.map((t) => JSON.stringify(t.body));
  } else {
    const [mediaResult, bodiesResult] = await Promise.all([
      supabase.from("help_media").select("*").order("created_at", { ascending: false }),
      supabase.from("help_article_translations").select("body"),
    ]);
    if (mediaResult.error) throw new Error(`Failed to load media: ${mediaResult.error.message}`);
    if (bodiesResult.error) throw new Error(`Failed to load bodies: ${bodiesResult.error.message}`);
    media = mediaResult.data as HelpMedia[];
    bodies = (bodiesResult.data as { body: unknown }[]).map((row) => JSON.stringify(row.body));
  }

  return media.map((row) => ({
    ...row,
    usageCount: bodies.filter((body) => body.includes(row.storage_path)).length,
  }));
}

export async function getAdminHelpMediaById(id: string): Promise<HelpMedia | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return localMedia().find((m) => m.id === id) ?? null;
  const { data, error } = await supabase.from("help_media").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to load media: ${error.message}`);
  return (data as HelpMedia | null) ?? null;
}

// ---------------------------------------------------------------------------
// Redirects
// ---------------------------------------------------------------------------

export async function getAdminHelpRedirects(): Promise<HelpRedirect[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return localRedirects();
  const { data, error } = await supabase
    .from("help_redirects")
    .select("*")
    .order("hits", { ascending: false })
    .order("source_path", { ascending: true });
  if (error) throw new Error(`Failed to load redirects: ${error.message}`);
  return data as HelpRedirect[];
}

export interface HelpNotFoundRow {
  path: string;
  hits: number;
  first_seen: string;
  last_seen: string;
}

/** Paths readers arrived at that matched nothing — candidates for a redirect. */
export async function getAdminHelpNotFound(limit = 50): Promise<HelpNotFoundRow[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return localNotFound().slice(0, limit);
  const { data, error } = await supabase
    .from("help_not_found")
    .select("*")
    .order("hits", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load missing paths: ${error.message}`);
  return data as HelpNotFoundRow[];
}
