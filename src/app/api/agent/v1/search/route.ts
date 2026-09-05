import { NextResponse, type NextRequest } from "next/server";

import { isLocale } from "@/i18n/config";
import { getSupabase } from "@/lib/data/supabase";
import { requireAgentKey } from "@/lib/help/agent-auth";
import { embedText, isEmbeddingConfigured } from "@/lib/help/embeddings";
import { helpArticleHref } from "@/lib/help/paths";
import { searchHelp } from "@/lib/help/search";
import { absoluteUrl } from "@/lib/help/seo";
import type { Locale } from "@/lib/types";

/**
 * Retrieval for the AI Agent, v1 (brief §7).
 *
 *   GET /api/agent/v1/search?q=…&locale=ar&limit=6
 *
 * Returns the passages that answer the question, each with the article's
 * public URL so the agent can cite "اقرأ المزيد". When embeddings are
 * configured the passages come from `help_article_chunks` by cosine
 * similarity; otherwise the same lexical ranking the site's own search uses
 * answers with article excerpts, so the agent is never left with nothing.
 */
export const dynamic = "force-dynamic";

const MAX_LIMIT = 12;

interface Passage {
  article_id: string;
  language: Locale;
  title: string;
  url: string;
  content: string;
  similarity: number | null;
  retrieval: "semantic" | "lexical";
}

export async function GET(request: NextRequest) {
  const denied = requireAgentKey(request);
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const query = (params.get("q") ?? "").trim();
  const rawLocale = params.get("locale");
  if (!query) return NextResponse.json({ error: "q is required" }, { status: 400 });
  if (rawLocale && !isLocale(rawLocale)) {
    return NextResponse.json({ error: "locale must be 'ar' or 'en'" }, { status: 400 });
  }
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "ar";
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get("limit")) || 6));

  const supabase = getSupabase();
  const passages: Passage[] = [];

  if (supabase && isEmbeddingConfigured) {
    const embedding = await embedText(query);
    if (embedding) {
      const { data, error } = await supabase.rpc("help_agent_retrieve", {
        query_embedding: JSON.stringify(embedding),
        lang: rawLocale && isLocale(rawLocale) ? rawLocale : null,
        max_results: limit,
        min_similarity: 0.5,
      });
      if (error) {
        console.warn(`agent retrieve failed: ${error.message}`);
      } else {
        for (const row of data as {
          article_id: string;
          language: Locale;
          slug: string;
          title: string;
          content: string;
          similarity: number;
        }[]) {
          passages.push({
            article_id: row.article_id,
            language: row.language,
            title: row.title,
            url: absoluteUrl(helpArticleHref(row.language, row.slug)),
            content: row.content,
            similarity: Number(row.similarity),
            retrieval: "semantic",
          });
        }
      }
    }
  }

  // Nothing embedded yet, or nothing close enough: fall back to the lexical
  // ranking rather than answering "no results" for a question we can serve.
  if (passages.length === 0) {
    const { results } = await searchHelp(locale, query, limit);
    for (const result of results) {
      passages.push({
        article_id: result.id,
        language: locale,
        title: result.title,
        url: absoluteUrl(helpArticleHref(locale, result.slug)),
        content: result.snippet.map((part) => part.text).join(""),
        similarity: null,
        retrieval: "lexical",
      });
    }
  }

  return NextResponse.json(
    {
      version: "1.0.0",
      query,
      locale,
      retrieval: passages[0]?.retrieval ?? "lexical",
      passages,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
