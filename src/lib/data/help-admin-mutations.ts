import "server-only";

import { randomUUID } from "node:crypto";

import {
  localDeleteCollection,
  localDeleteMedia,
  localDeleteRedirect,
  localDeleteTranslation,
  localHelpContent,
  localMedia,
  localUpsertArticle,
  localUpsertCollection,
  localUpsertMedia,
  localUpsertRedirect,
  localUpsertTranslation,
} from "@/lib/data/help-local-store";
import { getServiceSupabase } from "@/lib/data/supabase-admin";
import { translationRow, type HelpTranslationInput } from "@/lib/help/translation-row";
import { removeHelpMediaFile } from "@/lib/help/media";
import type {
  HelpArticle,
  HelpArticleStatus,
  HelpArticleTranslation,
  HelpCollection,
  HelpMedia,
  HelpRedirect,
} from "@/lib/help/types";
import type { Locale } from "@/lib/types";

/**
 * Admin writes for the help center. Every function here is called only from an
 * action that has already resolved an admin session — the guard lives there,
 * so this module stays about *what* changes rather than *who may*.
 *
 * `body_plain`, `toc` and `reading_minutes` are derived here on every save,
 * which is the promise the schema makes: nobody edits them by hand.
 */

export class SlugTaken extends Error {
  constructor(public readonly language: Locale | "collection") {
    super("slug taken");
    this.name = "SlugTaken";
  }
}

export class CollectionNotEmpty extends Error {
  constructor() {
    super("collection has articles");
    this.name = "CollectionNotEmpty";
  }
}

const UNIQUE_VIOLATION = "23505";

// The editor page and the save action both type against this; it lives with
// the row builder that consumes it.
export type { HelpTranslationInput };

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export interface HelpArticleInput {
  collection_id: string;
  status: HelpArticleStatus;
  is_pinned: boolean;
  sort_order: number;
  section: { ar: string; en: string } | null;
  icon: string;
  translations: { ar: HelpTranslationInput; en: HelpTranslationInput | null };
}

export async function saveHelpArticle(
  id: string | null,
  input: HelpArticleInput,
): Promise<{ id: string }> {
  const now = new Date().toISOString();
  const supabase = getServiceSupabase();

  if (!supabase) {
    const local = localHelpContent();
    const existing = id ? local.articles.find((a) => a.id === id) : undefined;
    const articleId = existing?.id ?? randomUUID();

    for (const language of ["ar", "en"] as const) {
      const slug = input.translations[language]?.slug;
      if (!slug) continue;
      const clash = local.translations.find(
        (t) => t.language === language && t.slug === slug && t.article_id !== articleId,
      );
      if (clash) throw new SlugTaken(language);
    }

    const article: HelpArticle = {
      id: articleId,
      collection_id: input.collection_id,
      status: input.status,
      is_pinned: input.is_pinned,
      sort_order: input.sort_order,
      section_ar: input.section?.ar ?? null,
      section_en: input.section?.en ?? null,
      icon: input.icon,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      published_at:
        input.status === "published" ? (existing?.published_at ?? now) : (existing?.published_at ?? null),
    };
    localUpsertArticle(article);

    for (const language of ["ar", "en"] as const) {
      const current = local.translations.find(
        (t) => t.article_id === articleId && t.language === language,
      );
      const next = input.translations[language];
      if (next) localUpsertTranslation(translationRow(articleId, language, next, current, now));
      else if (current) localDeleteTranslation(current.id);
    }
    return { id: articleId };
  }

  // --- Supabase -----------------------------------------------------------
  let articleId = id;
  let publishedAt: string | null = null;
  if (articleId) {
    const { data, error } = await supabase
      .from("help_articles")
      .select("published_at")
      .eq("id", articleId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load article: ${error.message}`);
    if (!data) throw new Error("Article not found");
    publishedAt = (data as { published_at: string | null }).published_at;
  }

  const articleRow = {
    collection_id: input.collection_id,
    status: input.status,
    is_pinned: input.is_pinned,
    sort_order: input.sort_order,
    section_ar: input.section?.ar ?? null,
    section_en: input.section?.en ?? null,
    icon: input.icon,
    published_at: input.status === "published" ? (publishedAt ?? now) : publishedAt,
  };

  if (articleId) {
    const { error } = await supabase.from("help_articles").update(articleRow).eq("id", articleId);
    if (error) throw new Error(`Failed to update article: ${error.message}`);
  } else {
    const { data, error } = await supabase
      .from("help_articles")
      .insert(articleRow)
      .select("id")
      .single();
    if (error) throw new Error(`Failed to create article: ${error.message}`);
    articleId = (data as { id: string }).id;
  }

  // The stored row is needed for two reasons: `translationRow` keeps the
  // existing primary key and creation date, and the review flag is decided by
  // comparing the incoming summary against the one already stored.
  const existingByLanguage = new Map<Locale, HelpArticleTranslation>();
  {
    const { data, error } = await supabase
      .from("help_article_translations")
      .select("*")
      .eq("article_id", articleId);
    if (error) throw new Error(`Failed to load translations: ${error.message}`);
    for (const row of (data ?? []) as HelpArticleTranslation[]) {
      existingByLanguage.set(row.language, row);
    }
  }

  for (const language of ["ar", "en"] as const) {
    const next = input.translations[language];
    if (!next) {
      const { error } = await supabase
        .from("help_article_translations")
        .delete()
        .eq("article_id", articleId)
        .eq("language", language);
      if (error) throw new Error(`Failed to remove translation: ${error.message}`);
      continue;
    }
    // One row builder for both backends. It used to be two column lists that
    // had to agree, and they stopped agreeing: this one carried the body and
    // the meta while silently dropping `answer_summary`, `question_title`,
    // `key_facts` and `summary_needs_review`, so those four fields could be
    // typed, saved, and lost without an error anywhere.
    const row = translationRow(articleId, language, next, existingByLanguage.get(language), now);
    const { error } = await supabase
      .from("help_article_translations")
      .upsert(row, { onConflict: "article_id,language" });
    if (error) {
      if (error.code === UNIQUE_VIOLATION) throw new SlugTaken(language);
      throw new Error(`Failed to save ${language} translation: ${error.message}`);
    }
  }

  return { id: articleId };
}

export async function setHelpArticlesStatus(
  ids: string[],
  status: HelpArticleStatus,
): Promise<void> {
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  const supabase = getServiceSupabase();

  if (!supabase) {
    for (const article of localHelpContent().articles) {
      if (!ids.includes(article.id)) continue;
      localUpsertArticle({
        ...article,
        status,
        updated_at: now,
        published_at: status === "published" ? (article.published_at ?? now) : article.published_at,
      });
    }
    return;
  }

  // Two statements: those never published get a timestamp, the rest keep theirs.
  if (status === "published") {
    const { error } = await supabase
      .from("help_articles")
      .update({ status, published_at: now })
      .in("id", ids)
      .is("published_at", null);
    if (error) throw new Error(`Failed to publish: ${error.message}`);
  }
  const { error } = await supabase.from("help_articles").update({ status }).in("id", ids);
  if (error) throw new Error(`Failed to change status: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export interface HelpCollectionInput {
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  icon: string;
  is_published: boolean;
}

export async function saveHelpCollection(
  id: string | null,
  input: HelpCollectionInput,
): Promise<{ id: string }> {
  const now = new Date().toISOString();
  const supabase = getServiceSupabase();

  if (!supabase) {
    const local = localHelpContent();
    const existing = id ? local.collections.find((c) => c.id === id) : undefined;
    if (local.collections.some((c) => c.slug === input.slug && c.id !== existing?.id)) {
      throw new SlugTaken("collection");
    }
    const maxOrder = Math.max(0, ...local.collections.map((c) => c.sort_order));
    const collection: HelpCollection = {
      id: existing?.id ?? randomUUID(),
      ...input,
      sort_order: existing?.sort_order ?? maxOrder + 1,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    localUpsertCollection(collection);
    return { id: collection.id };
  }

  if (id) {
    const { error } = await supabase.from("help_collections").update(input).eq("id", id);
    if (error) {
      if (error.code === UNIQUE_VIOLATION) throw new SlugTaken("collection");
      throw new Error(`Failed to update collection: ${error.message}`);
    }
    return { id };
  }

  const { data: last } = await supabase
    .from("help_collections")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("help_collections")
    .insert({ ...input, sort_order })
    .select("id")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw new SlugTaken("collection");
    throw new Error(`Failed to create collection: ${error.message}`);
  }
  return { id: (data as { id: string }).id };
}

export async function deleteHelpCollection(id: string): Promise<void> {
  const supabase = getServiceSupabase();

  if (!supabase) {
    if (localHelpContent().articles.some((a) => a.collection_id === id)) {
      throw new CollectionNotEmpty();
    }
    localDeleteCollection(id);
    return;
  }

  const { count, error: countError } = await supabase
    .from("help_articles")
    .select("id", { count: "exact", head: true })
    .eq("collection_id", id);
  if (countError) throw new Error(`Failed to count articles: ${countError.message}`);
  if ((count ?? 0) > 0) throw new CollectionNotEmpty();

  const { error } = await supabase.from("help_collections").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete collection: ${error.message}`);
}

/** Persists a new order: the array's position becomes `sort_order`, 1-based. */
export async function reorderHelpCollections(ids: string[]): Promise<void> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();

  if (!supabase) {
    const local = localHelpContent();
    ids.forEach((id, index) => {
      const collection = local.collections.find((c) => c.id === id);
      if (collection) localUpsertCollection({ ...collection, sort_order: index + 1, updated_at: now });
    });
    return;
  }

  // One update per row; the list is a handful long.
  for (const [index, id] of ids.entries()) {
    const { error } = await supabase
      .from("help_collections")
      .update({ sort_order: index + 1 })
      .eq("id", id);
    if (error) throw new Error(`Failed to reorder collections: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export async function createHelpMedia(
  input: Omit<HelpMedia, "id" | "created_at">,
): Promise<HelpMedia> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    const row: HelpMedia = { id: randomUUID(), created_at: new Date().toISOString(), ...input };
    localUpsertMedia(row);
    return row;
  }
  const { data, error } = await supabase.from("help_media").insert(input).select("*").single();
  if (error) throw new Error(`Failed to record media: ${error.message}`);
  return data as HelpMedia;
}

export async function updateHelpMediaAlt(
  id: string,
  alt_ar: string | null,
  alt_en: string | null,
): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    const row = localMedia().find((m) => m.id === id);
    if (row) localUpsertMedia({ ...row, alt_ar, alt_en });
    return;
  }
  const { error } = await supabase.from("help_media").update({ alt_ar, alt_en }).eq("id", id);
  if (error) throw new Error(`Failed to update media: ${error.message}`);
}

export async function deleteHelpMedia(row: HelpMedia): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    localDeleteMedia(row.id);
  } else {
    const { error } = await supabase.from("help_media").delete().eq("id", row.id);
    if (error) throw new Error(`Failed to delete media: ${error.message}`);
  }
  await removeHelpMediaFile(row.storage_path);
}

// ---------------------------------------------------------------------------
// Redirects
// ---------------------------------------------------------------------------

export interface HelpRedirectInput {
  source_path: string;
  target_path: string;
  status_code?: number;
}

/** Inserts or replaces by source path. Returns how many rows were written. */
export async function upsertHelpRedirects(inputs: HelpRedirectInput[]): Promise<number> {
  if (inputs.length === 0) return 0;
  const now = new Date().toISOString();
  const supabase = getServiceSupabase();

  if (!supabase) {
    for (const input of inputs) {
      const row: HelpRedirect = {
        id: randomUUID(),
        source_path: input.source_path,
        target_path: input.target_path,
        status_code: input.status_code ?? 301,
        hits: 0,
        created_at: now,
        updated_at: now,
      };
      localUpsertRedirect(row);
    }
    return inputs.length;
  }

  const { error } = await supabase.from("help_redirects").upsert(
    inputs.map((input) => ({
      source_path: input.source_path,
      target_path: input.target_path,
      status_code: input.status_code ?? 301,
    })),
    { onConflict: "source_path" },
  );
  if (error) throw new Error(`Failed to save redirects: ${error.message}`);
  return inputs.length;
}

export async function deleteHelpRedirect(id: string): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    localDeleteRedirect(id);
    return;
  }
  const { error } = await supabase.from("help_redirects").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete redirect: ${error.message}`);
}
