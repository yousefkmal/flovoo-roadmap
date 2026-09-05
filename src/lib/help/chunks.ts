import "server-only";

import { getServiceSupabase } from "@/lib/data/supabase-admin";
import { EMBEDDING_MODEL, embedTexts, isEmbeddingConfigured } from "@/lib/help/embeddings";
import type { HelpArticleTranslation } from "@/lib/help/types";
import type { Locale } from "@/lib/types";

/**
 * Chunking and embedding for retrieval (brief §7).
 *
 * `body_plain` is split into overlapping passages, each embedded once and
 * stored in `help_article_chunks` with the model that produced it — so a model
 * change is a targeted re-embed of the rows that name the old model, not a
 * guess about which vectors are stale.
 *
 * Nothing here is allowed to fail a save. An article that is published but not
 * yet embedded is still readable and still findable lexically; the reverse —
 * losing an admin's edit because a vendor was slow — is not acceptable.
 */

import { chunkText } from "@/lib/help/chunks-core";

export { chunkText };

export interface ChunkSyncResult {
  status: "written" | "cleared" | "skipped" | "failed";
  chunks: number;
}

/**
 * Brings an article's chunks in line with its current state: published means
 * one row per passage per language, anything else means no rows at all
 * (brief §13.5). Called after every save and every status change.
 */
export async function syncArticleChunks(
  articleId: string,
  status: string,
  translations: HelpArticleTranslation[],
): Promise<ChunkSyncResult> {
  const supabase = getServiceSupabase();
  // Without a database there is nowhere to put vectors; without a key there is
  // nothing to put. Both are ordinary states, not errors.
  if (!supabase) return { status: "skipped", chunks: 0 };

  try {
    if (status !== "published") {
      const { error } = await supabase
        .from("help_article_chunks")
        .delete()
        .eq("article_id", articleId);
      if (error) throw new Error(error.message);
      return { status: "cleared", chunks: 0 };
    }

    if (!isEmbeddingConfigured) return { status: "skipped", chunks: 0 };

    const rows: {
      article_id: string;
      language: Locale;
      chunk_index: number;
      content: string;
      embedding: string;
      model: string;
      updated_at: string;
    }[] = [];
    const now = new Date().toISOString();

    for (const translation of translations) {
      const passages = chunkText(translation.body_plain);
      if (passages.length === 0) continue;
      // The title rides on the first passage: a query often names the article.
      passages[0] = `${translation.title}\n\n${passages[0]}`;

      const vectors = await embedTexts(passages);
      if (!vectors) continue;

      vectors.forEach((vector, index) => {
        rows.push({
          article_id: articleId,
          language: translation.language,
          chunk_index: index,
          content: passages[index],
          // pgvector parses its own text form; a JSON array would not cast.
          embedding: JSON.stringify(vector),
          model: EMBEDDING_MODEL,
          updated_at: now,
        });
      });
    }

    if (rows.length === 0) {
      await supabase.from("help_article_chunks").delete().eq("article_id", articleId);
      return { status: "cleared", chunks: 0 };
    }

    const { error: upsertError } = await supabase
      .from("help_article_chunks")
      .upsert(rows, { onConflict: "article_id,language,chunk_index" });
    if (upsertError) throw new Error(upsertError.message);

    // A shorter article leaves higher indexes behind; remove them.
    const highest = new Map<string, number>();
    for (const row of rows) {
      highest.set(row.language, Math.max(highest.get(row.language) ?? -1, row.chunk_index));
    }
    for (const [language, max] of highest) {
      await supabase
        .from("help_article_chunks")
        .delete()
        .eq("article_id", articleId)
        .eq("language", language)
        .gt("chunk_index", max);
    }

    return { status: "written", chunks: rows.length };
  } catch (error) {
    console.error("[flovoo] chunk sync failed", error);
    return { status: "failed", chunks: 0 };
  }
}

/** How many chunks exist, and which models produced them. */
export async function getChunkCoverage(): Promise<{
  chunks: number;
  articles: number;
  models: string[];
}> {
  const supabase = getServiceSupabase();
  if (!supabase) return { chunks: 0, articles: 0, models: [] };
  const { data, error } = await supabase.from("help_article_chunks").select("article_id, model");
  if (error) return { chunks: 0, articles: 0, models: [] };
  const rows = data as { article_id: string; model: string }[];
  return {
    chunks: rows.length,
    articles: new Set(rows.map((r) => r.article_id)).size,
    models: [...new Set(rows.map((r) => r.model))],
  };
}
