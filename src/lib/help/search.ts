import "server-only";

import { getHelpCollections, getHelpSearchCorpus } from "@/lib/data/help-repository";
import { getSupabase } from "@/lib/data/supabase";
import { normalizeForSearch, searchTokens } from "@/lib/help/arabic";
import { embedText, isEmbeddingConfigured } from "@/lib/help/embeddings";
import { bestWordSimilarity, trigramSimilarity } from "@/lib/help/trigram";
import type { HelpSearchDocument } from "@/lib/help/types";
import type { Locale } from "@/lib/types";

/**
 * Help search, in two backends with one ranking.
 *
 * With Supabase the database ranks: `help_search()` combines trigram
 * similarity on the normalized title and text with, when an embedding
 * provider is configured, cosine similarity over the article chunks. Without
 * Supabase the same lexical formula runs here over the seed, so local results
 * order the way production does. Snippets and highlighting are always built
 * here, from the plain text, against the normalized query tokens.
 */

export interface SnippetPart {
  text: string;
  match: boolean;
}

export interface HelpSearchResult {
  id: string;
  slug: string;
  title: string;
  titleParts: SnippetPart[];
  excerpt: string | null;
  snippet: SnippetPart[];
  collection: { slug: string; name: string };
  score: number;
}

export interface HelpSearchResponse {
  query: string;
  results: HelpSearchResult[];
  /** Whether the semantic leg took part in this ranking. */
  semantic: boolean;
}

export interface HelpRelatedArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  collectionName: string;
}

export const MIN_QUERY_LENGTH = 2;

/** A query token counts as present in a text when its best word match clears this. */
const TOKEN_MATCH = 0.45;
/** Words in a snippet are highlighted when they match a token this closely. */
const HIGHLIGHT_MATCH = 0.5;
const SNIPPET_LENGTH = 170;

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchHelp(
  locale: Locale,
  rawQuery: string,
  limit = 8,
): Promise<HelpSearchResponse> {
  const query = rawQuery.trim().replace(/\s+/g, " ").slice(0, 200);
  if (query.length < MIN_QUERY_LENGTH) return { query, results: [], semantic: false };

  const tokens = searchTokens(query);
  if (tokens.length === 0) return { query, results: [], semantic: false };

  const supabase = getSupabase();
  const ranked = supabase
    ? await rankWithDatabase(locale, query, limit)
    : { rows: rankLocally(await getHelpSearchCorpus(locale), query, tokens, limit), semantic: false };

  const results = ranked.rows.map(({ document, score }) => ({
    id: document.id,
    slug: document.slug,
    title: document.title,
    titleParts: highlight(document.title, tokens),
    excerpt: document.excerpt,
    snippet: buildSnippet(document.bodyPlain, document.excerpt, tokens),
    collection: { slug: document.collection.slug, name: document.collection.name },
    score,
  }));

  return { query, results, semantic: ranked.semantic };
}

interface Ranked {
  document: HelpSearchDocument;
  score: number;
}

function rankLocally(
  corpus: HelpSearchDocument[],
  query: string,
  tokens: string[],
  limit: number,
): Ranked[] {
  const normalizedQuery = normalizeForSearch(query);
  const ranked: Ranked[] = [];

  for (const document of corpus) {
    const title = normalizeForSearch(document.title);
    const text = normalizeForSearch(
      `${document.title} ${document.excerpt ?? ""} ${document.bodyPlain}`,
    );

    const titleWord = average(tokens.map((t) => bestWordSimilarity(t, title)));
    const textWord = average(tokens.map((t) => bestWordSimilarity(t, text)));
    const titleWhole = trigramSimilarity(title, normalizedQuery);
    const textWhole = trigramSimilarity(text, normalizedQuery);

    // Mirrors the weights in `help_search()`.
    const score = 3 * titleWhole + 2 * titleWord + 1 * textWhole + 1.5 * textWord;
    const matches = tokens.some((t) => bestWordSimilarity(t, text) >= TOKEN_MATCH);
    if (matches || titleWhole >= 0.3) ranked.push({ document, score });
  }

  return ranked
    .sort((a, b) => b.score - a.score || a.document.title.localeCompare(b.document.title))
    .slice(0, limit);
}

interface SearchRow {
  article_id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_plain: string;
  collection_id: string;
  score: number;
}

async function rankWithDatabase(
  locale: Locale,
  query: string,
  limit: number,
): Promise<{ rows: Ranked[]; semantic: boolean }> {
  const supabase = getSupabase()!;
  const embedding = isEmbeddingConfigured ? await embedText(query) : null;

  const { data, error } = await supabase.rpc("help_search", {
    q: query,
    lang: locale,
    // pgvector reads its text form; a JSON array would not cast.
    query_embedding: embedding ? JSON.stringify(embedding) : null,
    max_results: limit,
  });
  if (error) throw new Error(`Help search failed: ${error.message}`);

  const collections = await getHelpCollections();
  const collectionById = new Map(collections.map((c) => [c.id, c]));

  const rows = (data as SearchRow[]).flatMap((row) => {
    const collection = collectionById.get(row.collection_id);
    if (!collection) return [];
    return [
      {
        document: {
          id: row.article_id,
          slug: row.slug,
          title: row.title,
          excerpt: row.excerpt,
          bodyPlain: row.body_plain,
          collection: {
            id: collection.id,
            slug: collection.slug,
            name: locale === "ar" ? collection.name_ar : collection.name_en,
          },
        },
        score: row.score,
      },
    ];
  });

  return { rows, semantic: embedding !== null };
}

// ---------------------------------------------------------------------------
// Related articles
// ---------------------------------------------------------------------------

export async function getRelatedHelpArticles(
  locale: Locale,
  articleId: string,
  limit = 3,
): Promise<HelpRelatedArticle[]> {
  const supabase = getSupabase();

  if (supabase) {
    const { data, error } = await supabase.rpc("help_related", {
      source_article: articleId,
      lang: locale,
      max_results: limit,
    });
    if (error) throw new Error(`Related articles failed: ${error.message}`);
    const collections = await getHelpCollections();
    const nameById = new Map(
      collections.map((c) => [c.id, locale === "ar" ? c.name_ar : c.name_en]),
    );
    return (data as Omit<SearchRow, "body_plain">[]).map((row) => ({
      id: row.article_id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      collectionName: nameById.get(row.collection_id) ?? "",
    }));
  }

  const corpus = await getHelpSearchCorpus(locale);
  const source = corpus.find((d) => d.id === articleId);
  if (!source) return [];

  const sourceText = normalizeForSearch(`${source.title} ${source.excerpt ?? ""} ${source.bodyPlain}`);
  const sourceTitle = normalizeForSearch(source.title);

  return corpus
    .filter((d) => d.id !== articleId)
    .map((document) => {
      const text = normalizeForSearch(
        `${document.title} ${document.excerpt ?? ""} ${document.bodyPlain}`,
      );
      // Mirrors `help_related()`: text closeness, a little title, same topic.
      const score =
        trigramSimilarity(text, sourceText) +
        0.5 * trigramSimilarity(normalizeForSearch(document.title), sourceTitle) +
        (document.collection.id === source.collection.id ? 0.6 : 0);
      return { document, score };
    })
    .sort((a, b) => b.score - a.score || a.document.title.localeCompare(b.document.title))
    .slice(0, limit)
    .map(({ document }) => ({
      id: document.id,
      slug: document.slug,
      title: document.title,
      excerpt: document.excerpt,
      collectionName: document.collection.name,
    }));
}

// ---------------------------------------------------------------------------
// Snippets and highlighting
// ---------------------------------------------------------------------------

function wordMatches(word: string, tokens: string[]): boolean {
  const normalized = normalizeForSearch(word);
  if (!normalized) return false;
  return tokens.some(
    (t) =>
      normalized === t ||
      (t.length >= 2 && normalized.startsWith(t)) ||
      trigramSimilarity(normalized, t) >= HIGHLIGHT_MATCH,
  );
}

/** Splits text into words and whitespace, marking the words that match. */
export function highlight(text: string, tokens: string[]): SnippetPart[] {
  const parts: SnippetPart[] = [];
  for (const piece of text.split(/(\s+)/)) {
    if (!piece) continue;
    const match = !/^\s+$/.test(piece) && wordMatches(piece, tokens);
    const last = parts[parts.length - 1];
    if (last && last.match === match) last.text += piece;
    else parts.push({ text: piece, match });
  }
  return parts;
}

/**
 * The sentence of the body that carries the most query tokens, trimmed to a
 * window around its first match; the excerpt when nothing in the body matches.
 */
export function buildSnippet(
  bodyPlain: string,
  excerpt: string | null,
  tokens: string[],
  maxLength = SNIPPET_LENGTH,
): SnippetPart[] {
  const sentences = bodyPlain
    .split(/(?<=[.!?؟])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let best: { sentence: string; hits: number } | null = null;
  for (const sentence of sentences) {
    const normalized = normalizeForSearch(sentence);
    const hits = tokens.filter((t) => bestWordSimilarity(t, normalized) >= TOKEN_MATCH).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { sentence, hits };
  }

  const source = best?.sentence ?? excerpt ?? sentences[0] ?? "";
  return highlight(trimAround(source, tokens, maxLength), tokens);
}

function trimAround(text: string, tokens: string[], maxLength: number): string {
  if (text.length <= maxLength) return text;

  const words = text.split(/\s+/);
  const firstMatch = Math.max(
    0,
    words.findIndex((w) => wordMatches(w, tokens)),
  );

  // Start a few words before the match so the reader has a run-in.
  let start = Math.max(0, firstMatch - 4);
  let end = start;
  let length = 0;
  while (end < words.length && length + words[end].length + 1 <= maxLength) {
    length += words[end].length + 1;
    end++;
  }
  // If the window ran out before reaching the match, slide it forward.
  if (end <= firstMatch) {
    start = firstMatch;
    end = firstMatch;
    length = 0;
    while (end < words.length && length + words[end].length + 1 <= maxLength) {
      length += words[end].length + 1;
      end++;
    }
  }

  const clipped = words.slice(start, end).join(" ");
  return `${start > 0 ? "…" : ""}${clipped}${end < words.length ? "…" : ""}`;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}
