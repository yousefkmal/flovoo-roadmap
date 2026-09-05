import "server-only";

import { localEvents, localHelpContent, localNotFound, localRedirects } from "@/lib/data/help-local-store";
import { getServiceSupabase } from "@/lib/data/supabase-admin";
import type { Locale } from "@/lib/types";

/**
 * The admin dashboard's reads (brief §9). Plain SQL aggregates behind one
 * function per card — no external analytics service, and no raw event rows
 * pulled into the app to be counted there.
 *
 * Without Supabase the same shapes are computed from the local event file, so
 * the dashboard is developable before anything is deployed.
 */

export interface HelpOverview {
  viewsTotal: number;
  viewsAr: number;
  viewsEn: number;
  viewsPrevious: number;
  searchesTotal: number;
  searchesZero: number;
  searchesClicked: number;
  feedbackTotal: number;
  feedbackHelpful: number;
}

export interface DailyViews {
  day: string;
  ar: number;
  en: number;
}

export interface TopArticle {
  articleId: string;
  language: Locale;
  views: number;
}

export interface QueryStat {
  query: string;
  language: Locale;
  searches: number;
  zeroResults: number;
  clicks: number;
  lastSeen: string;
}

export interface ContentGapQuery {
  query: string;
  language: Locale;
  searches: number;
  lastSeen: string;
}

export interface NegativeFeedback {
  id: string;
  articleId: string;
  language: Locale;
  comment: string | null;
  createdAt: string;
}

export interface Helpfulness {
  articleId: string;
  language: Locale;
  helpful: number;
  unhelpful: number;
  views: number;
}

function since(days: number): number {
  return Date.now() - days * 86_400_000;
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export async function getHelpOverview(days: number): Promise<HelpOverview> {
  const supabase = getServiceSupabase();

  if (!supabase) {
    const events = localEvents();
    const from = since(days);
    const previousFrom = since(days * 2);
    const views = events.views.filter((v) => Date.parse(v.viewedAt) > from);
    const searches = events.searches.filter((q) => Date.parse(q.createdAt) > from);
    const feedback = events.feedback.filter((f) => Date.parse(f.createdAt) > from);
    return {
      viewsTotal: views.length,
      viewsAr: views.filter((v) => v.language === "ar").length,
      viewsEn: views.filter((v) => v.language === "en").length,
      viewsPrevious: events.views.filter((v) => {
        const at = Date.parse(v.viewedAt);
        return at > previousFrom && at <= from;
      }).length,
      searchesTotal: searches.length,
      searchesZero: searches.filter((q) => q.resultsCount === 0).length,
      searchesClicked: searches.filter((q) => q.clickedArticleId).length,
      feedbackTotal: feedback.length,
      feedbackHelpful: feedback.filter((f) => f.isHelpful).length,
    };
  }

  const { data, error } = await supabase.rpc("help_stats_overview", { days });
  if (error) throw new Error(`Failed to load overview: ${error.message}`);
  const row = (data as Record<string, number>[])[0] ?? {};
  const n = (key: string) => Number(row[key] ?? 0);
  return {
    viewsTotal: n("views_total"),
    viewsAr: n("views_ar"),
    viewsEn: n("views_en"),
    viewsPrevious: n("views_previous"),
    searchesTotal: n("searches_total"),
    searchesZero: n("searches_zero"),
    searchesClicked: n("searches_clicked"),
    feedbackTotal: n("feedback_total"),
    feedbackHelpful: n("feedback_helpful"),
  };
}

/** One row per day in the window, zero-filled, so the sparkline has no gaps. */
export async function getHelpDailyViews(days: number): Promise<DailyViews[]> {
  const buckets = new Map<string, DailyViews>();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    buckets.set(day, { day, ar: 0, en: 0 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    for (const view of localEvents().views) {
      const day = view.viewedAt.slice(0, 10);
      const bucket = buckets.get(day);
      if (bucket) bucket[view.language] += 1;
    }
  } else {
    const { data, error } = await supabase.rpc("help_views_daily", { days });
    if (error) throw new Error(`Failed to load view trend: ${error.message}`);
    for (const row of data as { day: string; language: Locale; views: number }[]) {
      const bucket = buckets.get(String(row.day).slice(0, 10));
      if (bucket) bucket[row.language] += Number(row.views);
    }
  }
  return [...buckets.values()];
}

export async function getHelpTopArticles(days: number, limit = 8): Promise<TopArticle[]> {
  const supabase = getServiceSupabase();

  if (!supabase) {
    const from = since(days);
    const counts = new Map<string, TopArticle>();
    for (const view of localEvents().views) {
      if (Date.parse(view.viewedAt) <= from) continue;
      const key = `${view.articleId}:${view.language}`;
      const entry = counts.get(key) ?? {
        articleId: view.articleId,
        language: view.language,
        views: 0,
      };
      entry.views += 1;
      counts.set(key, entry);
    }
    return [...counts.values()].sort((a, b) => b.views - a.views).slice(0, limit);
  }

  const { data, error } = await supabase.rpc("help_top_articles", { days, max_results: limit });
  if (error) throw new Error(`Failed to load top articles: ${error.message}`);
  return (data as { article_id: string; language: Locale; views: number }[]).map((row) => ({
    articleId: row.article_id,
    language: row.language,
    views: Number(row.views),
  }));
}

export async function getHelpTopQueries(days: number, limit = 10): Promise<QueryStat[]> {
  const supabase = getServiceSupabase();

  if (!supabase) {
    const from = since(days);
    const grouped = new Map<string, QueryStat>();
    for (const search of localEvents().searches) {
      if (Date.parse(search.createdAt) <= from) continue;
      const key = `${search.query}:${search.language}`;
      const entry = grouped.get(key) ?? {
        query: search.query,
        language: search.language,
        searches: 0,
        zeroResults: 0,
        clicks: 0,
        lastSeen: search.createdAt,
      };
      entry.searches += 1;
      if (search.resultsCount === 0) entry.zeroResults += 1;
      if (search.clickedArticleId) entry.clicks += 1;
      if (search.createdAt > entry.lastSeen) entry.lastSeen = search.createdAt;
      grouped.set(key, entry);
    }
    return [...grouped.values()].sort((a, b) => b.searches - a.searches).slice(0, limit);
  }

  const { data, error } = await supabase.rpc("help_top_queries", { days, max_results: limit });
  if (error) throw new Error(`Failed to load queries: ${error.message}`);
  return (
    data as {
      query: string;
      language: Locale;
      searches: number;
      zero_results: number;
      clicks: number;
      last_seen: string;
    }[]
  ).map((row) => ({
    query: row.query,
    language: row.language,
    searches: Number(row.searches),
    zeroResults: Number(row.zero_results),
    clicks: Number(row.clicks),
    lastSeen: row.last_seen,
  }));
}

// ---------------------------------------------------------------------------
// Content gap
// ---------------------------------------------------------------------------

export async function getHelpContentGaps(days = 90, limit = 30): Promise<ContentGapQuery[]> {
  const supabase = getServiceSupabase();

  if (!supabase) {
    const events = localEvents();
    const from = since(days);
    const dismissed = new Set(
      events.dismissals.filter((d) => d.kind === "query").map((d) => d.ref),
    );
    const grouped = new Map<string, ContentGapQuery>();
    for (const search of events.searches) {
      if (search.resultsCount !== 0 || Date.parse(search.createdAt) <= from) continue;
      if (dismissed.has(search.query)) continue;
      const key = `${search.query}:${search.language}`;
      const entry = grouped.get(key) ?? {
        query: search.query,
        language: search.language,
        searches: 0,
        lastSeen: search.createdAt,
      };
      entry.searches += 1;
      if (search.createdAt > entry.lastSeen) entry.lastSeen = search.createdAt;
      grouped.set(key, entry);
    }
    return [...grouped.values()].sort((a, b) => b.searches - a.searches).slice(0, limit);
  }

  const { data, error } = await supabase.rpc("help_content_gaps", { days, max_results: limit });
  if (error) throw new Error(`Failed to load content gaps: ${error.message}`);
  return (data as { query: string; language: Locale; searches: number; last_seen: string }[]).map(
    (row) => ({
      query: row.query,
      language: row.language,
      searches: Number(row.searches),
      lastSeen: row.last_seen,
    }),
  );
}

export async function getHelpNegativeFeedback(days = 90, limit = 30): Promise<NegativeFeedback[]> {
  const supabase = getServiceSupabase();

  if (!supabase) {
    const events = localEvents();
    const from = since(days);
    const dismissed = new Set(
      events.dismissals.filter((d) => d.kind === "feedback").map((d) => d.ref),
    );
    return events.feedback
      .filter(
        (f) => !f.isHelpful && Date.parse(f.createdAt) > from && !dismissed.has(f.id),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((f) => ({
        id: f.id,
        articleId: f.articleId,
        language: f.language,
        comment: f.comment,
        createdAt: f.createdAt,
      }));
  }

  const { data, error } = await supabase.rpc("help_negative_feedback", {
    days,
    max_results: limit,
  });
  if (error) throw new Error(`Failed to load feedback: ${error.message}`);
  return (
    data as {
      id: string;
      article_id: string;
      language: Locale;
      comment: string | null;
      created_at: string;
    }[]
  ).map((row) => ({
    id: row.id,
    articleId: row.article_id,
    language: row.language,
    comment: row.comment,
    createdAt: row.created_at,
  }));
}

export async function getHelpHelpfulness(days = 90, limit = 20): Promise<Helpfulness[]> {
  const supabase = getServiceSupabase();

  if (!supabase) {
    const events = localEvents();
    const from = since(days);
    const grouped = new Map<string, Helpfulness>();
    for (const f of events.feedback) {
      if (Date.parse(f.createdAt) <= from) continue;
      const key = `${f.articleId}:${f.language}`;
      const entry = grouped.get(key) ?? {
        articleId: f.articleId,
        language: f.language,
        helpful: 0,
        unhelpful: 0,
        views: 0,
      };
      if (f.isHelpful) entry.helpful += 1;
      else entry.unhelpful += 1;
      grouped.set(key, entry);
    }
    for (const v of events.views) {
      if (Date.parse(v.viewedAt) <= from) continue;
      const entry = grouped.get(`${v.articleId}:${v.language}`);
      if (entry) entry.views += 1;
    }
    return [...grouped.values()].sort((a, b) => b.unhelpful - a.unhelpful).slice(0, limit);
  }

  const { data, error } = await supabase.rpc("help_article_helpfulness", {
    days,
    max_results: limit,
  });
  if (error) throw new Error(`Failed to load helpfulness: ${error.message}`);
  return (
    data as {
      article_id: string;
      language: Locale;
      helpful: number;
      unhelpful: number;
      views: number;
    }[]
  ).map((row) => ({
    articleId: row.article_id,
    language: row.language,
    helpful: Number(row.helpful),
    unhelpful: Number(row.unhelpful),
    views: Number(row.views),
  }));
}

// ---------------------------------------------------------------------------
// Redirect health
// ---------------------------------------------------------------------------

export interface RedirectHealth {
  topRedirects: { sourcePath: string; targetPath: string; hits: number }[];
  topMissing: { path: string; hits: number; lastSeen: string }[];
}

export async function getHelpRedirectHealth(limit = 8): Promise<RedirectHealth> {
  const supabase = getServiceSupabase();

  if (!supabase) {
    return {
      topRedirects: localRedirects()
        .filter((r) => r.hits > 0)
        .slice(0, limit)
        .map((r) => ({ sourcePath: r.source_path, targetPath: r.target_path, hits: r.hits })),
      topMissing: localNotFound()
        .slice(0, limit)
        .map((m) => ({ path: m.path, hits: m.hits, lastSeen: m.last_seen })),
    };
  }

  const [redirects, missing] = await Promise.all([
    supabase
      .from("help_redirects")
      .select("source_path, target_path, hits")
      .gt("hits", 0)
      .order("hits", { ascending: false })
      .limit(limit),
    supabase
      .from("help_not_found")
      .select("path, hits, last_seen")
      .order("hits", { ascending: false })
      .limit(limit),
  ]);
  if (redirects.error) throw new Error(`Failed to load redirects: ${redirects.error.message}`);
  if (missing.error) throw new Error(`Failed to load missing paths: ${missing.error.message}`);

  return {
    topRedirects: (redirects.data as { source_path: string; target_path: string; hits: number }[]).map(
      (r) => ({ sourcePath: r.source_path, targetPath: r.target_path, hits: r.hits }),
    ),
    topMissing: (missing.data as { path: string; hits: number; last_seen: string }[]).map((m) => ({
      path: m.path,
      hits: m.hits,
      lastSeen: m.last_seen,
    })),
  };
}

/**
 * Titles for the article ids the aggregates return, in one lookup rather than
 * one per row. Falls back to the id so a deleted article never blanks a card.
 */
export async function getArticleTitles(
  ids: string[],
): Promise<Map<string, { title: string; slug: string; language: Locale }[]>> {
  const result = new Map<string, { title: string; slug: string; language: Locale }[]>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return result;

  const supabase = getServiceSupabase();
  const rows = supabase
    ? ((
        await supabase
          .from("help_article_translations")
          .select("article_id, language, title, slug")
          .in("article_id", unique)
      ).data as { article_id: string; language: Locale; title: string; slug: string }[] | null) ?? []
    : localHelpContent()
        .translations.filter((t) => unique.includes(t.article_id))
        .map((t) => ({
          article_id: t.article_id,
          language: t.language,
          title: t.title,
          slug: t.slug,
        }));

  for (const row of rows) {
    const list = result.get(row.article_id) ?? [];
    list.push({ title: row.title, slug: row.slug, language: row.language });
    result.set(row.article_id, list);
  }
  return result;
}
