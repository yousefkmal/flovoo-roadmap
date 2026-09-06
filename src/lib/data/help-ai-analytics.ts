import "server-only";

import { getServiceSupabase } from "@/lib/data/supabase-admin";

/**
 * What AI systems did with the help center.
 *
 * Read with the service key, like the rest of Phase 5's analytics: the SQL is
 * security-definer and checks `help_analytics_allowed()`, which is true for an
 * admin in the roster *or* the service role. `is_admin()` alone is false for
 * the service key and for a bootstrap admin, which is the bug 0010 fixed.
 *
 * Everything here returns empty rather than throwing. A dashboard that cannot
 * load its numbers should say so; it should not take the admin down.
 */

export interface AiOperatorRow {
  operator: string;
  purpose: "search" | "training" | "user";
  hits: number;
  verified_hits: number;
  articles_touched: number;
}

export interface AiArticleRow {
  articleId: string;
  title: string;
  language: string;
  retrievals: number;
  liveRetrievals: number;
  aiReferrals: number;
}

export interface AiVisibilitySnapshot {
  operators: AiOperatorRow[];
  /** Per day, per operator, for the chart. */
  timeline: { day: string; operator: string; hits: number }[];
  liveRetrievals: { title: string; language: string; path: string; ts: string }[];
  referrals: { source: string; visits: number }[];
  topArticles: AiArticleRow[];
  neverRetrieved: { title: string; language: string; updatedAt: string }[];
  assistantClicks: { target: string; clicks: number }[];
  indexNow: { submittedAt: string; ok: boolean; statusCode: number | null; urls: number }[];
  /** True when Supabase is not configured; the dashboard says so plainly. */
  unavailable: boolean;
}

const EMPTY: AiVisibilitySnapshot = {
  operators: [],
  timeline: [],
  liveRetrievals: [],
  referrals: [],
  topArticles: [],
  neverRetrieved: [],
  assistantClicks: [],
  indexNow: [],
  unavailable: true,
};

export async function getAiVisibility(days = 30): Promise<AiVisibilitySnapshot> {
  const supabase = getServiceSupabase();
  if (!supabase) return EMPTY;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [operators, hits, views, clicks, pings, never] = await Promise.all([
    supabase.rpc("help_ai_overview", { days }),
    supabase
      .from("help_ai_crawler_hits")
      .select("ts, bot_token, operator, purpose, path, article_id, language")
      .gte("ts", since)
      .order("ts", { ascending: false })
      .limit(5000),
    supabase.from("help_article_views").select("ai_source, article_id").gte("viewed_at", since).not("ai_source", "is", null),
    supabase.from("help_assistant_clicks").select("target, clicks"),
    supabase
      .from("help_indexnow_pings")
      .select("submitted_at, ok, status_code, urls")
      .order("submitted_at", { ascending: false })
      .limit(10),
    supabase.rpc("help_never_retrieved", { days: 60 }),
  ]);

  const hitRows = (hits.data ?? []) as {
    ts: string;
    bot_token: string;
    operator: string;
    purpose: string;
    path: string;
    article_id: string | null;
    language: string | null;
  }[];

  // Per day per operator, for the chart.
  const timelineMap = new Map<string, number>();
  for (const hit of hitRows) {
    const key = `${hit.ts.slice(0, 10)}|${hit.operator}`;
    timelineMap.set(key, (timelineMap.get(key) ?? 0) + 1);
  }

  // Titles for the article table, resolved in one query rather than per row.
  const articleIds = [...new Set(hitRows.map((h) => h.article_id).filter((id): id is string => Boolean(id)))];
  const titles = new Map<string, { title: string; language: string }>();
  if (articleIds.length) {
    const { data } = await supabase
      .from("help_article_translations")
      .select("article_id, title, language")
      .in("article_id", articleIds);
    for (const row of (data ?? []) as { article_id: string; title: string; language: string }[]) {
      // Arabic is the product default, so it names the row.
      if (!titles.has(row.article_id) || row.language === "ar") {
        titles.set(row.article_id, { title: row.title, language: row.language });
      }
    }
  }

  const perArticle = new Map<string, { retrievals: number; live: number; referrals: number }>();
  for (const hit of hitRows) {
    if (!hit.article_id) continue;
    const entry = perArticle.get(hit.article_id) ?? { retrievals: 0, live: 0, referrals: 0 };
    entry.retrievals++;
    if (hit.purpose === "user") entry.live++;
    perArticle.set(hit.article_id, entry);
  }
  for (const view of (views.data ?? []) as { ai_source: string; article_id: string }[]) {
    const entry = perArticle.get(view.article_id) ?? { retrievals: 0, live: 0, referrals: 0 };
    entry.referrals++;
    perArticle.set(view.article_id, entry);
  }

  const referralCounts = new Map<string, number>();
  for (const view of (views.data ?? []) as { ai_source: string }[]) {
    referralCounts.set(view.ai_source, (referralCounts.get(view.ai_source) ?? 0) + 1);
  }

  return {
    unavailable: false,
    operators: (operators.data ?? []) as AiOperatorRow[],
    timeline: [...timelineMap.entries()]
      .map(([key, count]) => {
        const [day, operator] = key.split("|");
        return { day, operator, hits: count };
      })
      .sort((a, b) => a.day.localeCompare(b.day)),
    liveRetrievals: hitRows
      .filter((h) => h.purpose === "user")
      .slice(0, 20)
      .map((h) => ({
        title: h.article_id ? (titles.get(h.article_id)?.title ?? h.path) : h.path,
        language: h.language ?? "—",
        path: h.path,
        ts: h.ts,
      })),
    referrals: [...referralCounts.entries()]
      .map(([source, visits]) => ({ source, visits }))
      .sort((a, b) => b.visits - a.visits),
    topArticles: [...perArticle.entries()]
      .map(([articleId, counts]) => ({
        articleId,
        title: titles.get(articleId)?.title ?? articleId,
        language: titles.get(articleId)?.language ?? "—",
        retrievals: counts.retrievals,
        liveRetrievals: counts.live,
        aiReferrals: counts.referrals,
      }))
      .sort((a, b) => b.retrievals - a.retrievals)
      .slice(0, 25),
    neverRetrieved: ((never.data ?? []) as { title: string; language: string; updated_at: string }[])
      .slice(0, 25)
      .map((r) => ({ title: r.title, language: r.language, updatedAt: r.updated_at })),
    assistantClicks: ((clicks.data ?? []) as { target: string; clicks: number }[])
      .reduce<{ target: string; clicks: number }[]>((acc, row) => {
        const found = acc.find((a) => a.target === row.target);
        if (found) found.clicks += row.clicks;
        else acc.push({ target: row.target, clicks: row.clicks });
        return acc;
      }, [])
      .sort((a, b) => b.clicks - a.clicks),
    indexNow: ((pings.data ?? []) as { submitted_at: string; ok: boolean; status_code: number | null; urls: string[] }[])
      .map((p) => ({
        submittedAt: p.submitted_at,
        ok: p.ok,
        statusCode: p.status_code,
        urls: p.urls?.length ?? 0,
      })),
  };
}
