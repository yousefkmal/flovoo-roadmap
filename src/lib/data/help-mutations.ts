import "server-only";

import {
  localAddFeedback,
  localHasFeedback,
  localLogSearch,
  localRecordSearchClick,
} from "@/lib/data/help-local-store";
import { getSupabase } from "@/lib/data/supabase";
import { getServiceSupabase } from "@/lib/data/supabase-admin";
import { takeToken } from "@/lib/rate-limit";
import type { Locale } from "@/lib/types";

/**
 * The help center's public writes: search logging and article feedback. Both
 * are anonymous, so both are rate limited per hashed IP before anything
 * reaches the database. Inserts prefer the service client so the new row's id
 * comes back (the anon role may insert but not read these tables); with only
 * the anon key the row is written and the id is simply unknown.
 */

export class HelpRateLimited extends Error {
  constructor() {
    super("rate limited");
    this.name = "HelpRateLimited";
  }
}

const SEARCH_LOGS_PER_IP = { limit: 60, windowMs: 60_000 };
const FEEDBACK_PER_IP = { limit: 20, windowMs: 60 * 60_000 };

export const MAX_QUERY_LENGTH = 200;
export const MAX_FEEDBACK_COMMENT = 1000;

// ---------------------------------------------------------------------------
// Search logging
// ---------------------------------------------------------------------------

export interface LogSearchInput {
  query: string;
  locale: Locale;
  resultsCount: number;
  ipHash: string | null;
}

/**
 * Records a search. Zero-result queries are the content-gap inbox's raw
 * material, so nothing is filtered here beyond length and rate.
 * Returns the row id when it is known, for click attribution.
 */
export async function logHelpSearch(input: LogSearchInput): Promise<string | null> {
  const query = input.query.trim().slice(0, MAX_QUERY_LENGTH);
  if (query.length < 2) return null;

  if (input.ipHash && !takeToken({ key: `help:search:${input.ipHash}`, ...SEARCH_LOGS_PER_IP })) {
    // Silently drop rather than fail the search: logging is a side effect.
    return null;
  }

  const row = { query, language: input.locale, results_count: input.resultsCount };

  const service = getServiceSupabase();
  if (service) {
    const { data, error } = await service
      .from("help_search_queries")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      console.warn(`help search: could not log query: ${error.message}`);
      return null;
    }
    return (data as { id: string }).id;
  }

  const anon = getSupabase();
  if (anon) {
    const { error } = await anon.from("help_search_queries").insert(row);
    if (error) console.warn(`help search: could not log query: ${error.message}`);
    return null;
  }

  return localLogSearch({ query, language: input.locale, resultsCount: input.resultsCount });
}

export async function recordHelpSearchClick(queryId: string, articleId: string): Promise<void> {
  const service = getServiceSupabase();
  if (service) {
    const { error } = await service
      .from("help_search_queries")
      .update({ clicked_article_id: articleId })
      .eq("id", queryId)
      .is("clicked_article_id", null);
    if (error) console.warn(`help search: could not record click: ${error.message}`);
    return;
  }
  if (getSupabase()) return; // anon key cannot update; attribution is lost, nothing else is.
  localRecordSearchClick(queryId, articleId);
}

// ---------------------------------------------------------------------------
// Article feedback
// ---------------------------------------------------------------------------

export interface FeedbackInput {
  articleId: string;
  locale: Locale;
  isHelpful: boolean;
  comment: string | null;
  /** Hash of the visitor's IP and user agent — never the raw values. */
  visitorHash: string;
}

export type FeedbackOutcome = "saved" | "duplicate";

export async function submitHelpFeedback(input: FeedbackInput): Promise<FeedbackOutcome> {
  if (!takeToken({ key: `help:feedback:${input.visitorHash}`, ...FEEDBACK_PER_IP })) {
    throw new HelpRateLimited();
  }

  const comment = input.comment?.trim().slice(0, MAX_FEEDBACK_COMMENT) || null;
  const row = {
    article_id: input.articleId,
    language: input.locale,
    is_helpful: input.isHelpful,
    comment,
    visitor_hash: input.visitorHash,
  };

  const supabase = getServiceSupabase() ?? getSupabase();
  if (supabase) {
    const { error } = await supabase.from("help_article_feedback").insert(row);
    if (error) throw new Error(`Failed to save feedback: ${error.message}`);
    return "saved";
  }

  if (localHasFeedback(input.articleId, input.visitorHash)) return "duplicate";
  localAddFeedback({
    articleId: input.articleId,
    language: input.locale,
    isHelpful: input.isHelpful,
    comment,
    visitorHash: input.visitorHash,
  });
  return "saved";
}
