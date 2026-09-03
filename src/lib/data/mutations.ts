import "server-only";

import { randomUUID } from "node:crypto";

import {
  localAddSubmission,
  localSubmissionCount,
  localToggleFollow,
  localToggleReaction,
  localToggleVote,
} from "@/lib/data/local-store";
import { getServiceSupabase } from "@/lib/data/supabase-admin";
import { takeToken } from "@/lib/rate-limit";
import type { Locale } from "@/i18n/config";

/**
 * The write path. Supabase when it is configured, process memory otherwise, so
 * the portal is usable end to end with no setup.
 */

export interface VoteResult {
  voted: boolean;
  count: number;
}

const VOTE_LIMIT = { limit: 60, windowMs: 60 * 60_000 };
const SUBMISSION_PER_EMAIL = { limit: 3, windowMs: 60 * 60_000 };
const SUBMISSION_PER_IP = { limit: 10, windowMs: 60 * 60_000 };

export class RateLimited extends Error {
  constructor() {
    super("rate limited");
    this.name = "RateLimited";
  }
}

/**
 * Casts or retracts a vote. Toggling is what people expect and still honours
 * "one vote per person per item" — the unique index on
 * `(feature_id, user_id)` is what actually guarantees it.
 */
export async function toggleVote(
  featureId: string,
  userId: string,
): Promise<VoteResult> {
  if (!takeToken({ key: `vote:${userId}`, ...VOTE_LIMIT })) {
    throw new RateLimited();
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    const voted = localToggleVote(featureId, userId);
    return { voted, count: 0 };
  }

  const { data: existing, error: readError } = await supabase
    .from("votes")
    .select("id")
    .eq("feature_id", featureId)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw new Error(`Failed to read vote: ${readError.message}`);

  if (existing) {
    const { error } = await supabase.from("votes").delete().eq("id", existing.id);
    if (error) throw new Error(`Failed to retract vote: ${error.message}`);
  } else {
    const { error } = await supabase
      .from("votes")
      .insert({ feature_id: featureId, user_id: userId });
    // A duplicate means the same person voted twice in parallel; the row that
    // already exists is the correct outcome, so this is not an error.
    if (error && error.code !== "23505") {
      throw new Error(`Failed to cast vote: ${error.message}`);
    }
  }

  // The count is maintained by a trigger, so read it back rather than guessing.
  const { data: feature, error: countError } = await supabase
    .from("features")
    .select("vote_count")
    .eq("id", featureId)
    .single();
  if (countError) throw new Error(`Failed to read count: ${countError.message}`);

  return { voted: !existing, count: feature.vote_count as number };
}

export interface SubmissionInput {
  title: string;
  description: string | null;
  categoryId: string | null;
  submitterName: string;
  submitterEmail: string;
  submittedBy: string;
  language: Locale;
  ipHash: string | null;
}

/**
 * Files a customer idea into the moderation queue. It never reaches the public
 * board — an admin approves it in Phase 3.
 */
export async function createSubmission(input: SubmissionInput): Promise<void> {
  const emailKey = `submit:email:${input.submitterEmail.toLowerCase()}`;
  if (!takeToken({ key: emailKey, ...SUBMISSION_PER_EMAIL })) throw new RateLimited();

  if (input.ipHash) {
    if (!takeToken({ key: `submit:ip:${input.ipHash}`, ...SUBMISSION_PER_IP })) {
      throw new RateLimited();
    }
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    if (localSubmissionCount(input.submitterEmail, SUBMISSION_PER_EMAIL.windowMs) >= SUBMISSION_PER_EMAIL.limit) {
      throw new RateLimited();
    }
    localAddSubmission({
      id: randomUUID(),
      title: input.title,
      description: input.description,
      categoryId: input.categoryId,
      submitterName: input.submitterName,
      submitterEmail: input.submitterEmail,
      language: input.language,
      createdAt: new Date().toISOString(),
    });
    return;
  }

  // The in-memory limiter only covers this instance; this is the check that
  // holds across all of them.
  const since = new Date(Date.now() - SUBMISSION_PER_EMAIL.windowMs).toISOString();
  const { count, error: countError } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("submitter_email", input.submitterEmail.toLowerCase())
    .gte("created_at", since);
  if (countError) throw new Error(`Failed to check recent submissions: ${countError.message}`);
  if ((count ?? 0) >= SUBMISSION_PER_EMAIL.limit) throw new RateLimited();

  const { error } = await supabase.from("submissions").insert({
    title: input.title,
    description: input.description,
    category_id: input.categoryId,
    submitter_name: input.submitterName,
    submitter_email: input.submitterEmail.toLowerCase(),
    submitted_by: input.submittedBy,
    language: input.language,
    status: "pending",
    ip_hash: input.ipHash,
  });
  if (error) throw new Error(`Failed to file submission: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Following and preferences
// ---------------------------------------------------------------------------

/** "Tell me when this one ships." Independent of voting, though a vote counts too. */
export async function toggleFollow(
  featureId: string,
  userId: string,
): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return localToggleFollow(userId, featureId);

  const { data: existing, error: readError } = await supabase
    .from("feature_subscriptions")
    .select("id")
    .eq("feature_id", featureId)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw new Error(`Failed to read follow: ${readError.message}`);

  if (existing) {
    const { error } = await supabase
      .from("feature_subscriptions")
      .delete()
      .eq("id", existing.id);
    if (error) throw new Error(`Failed to unfollow: ${error.message}`);
    return false;
  }

  const { error } = await supabase
    .from("feature_subscriptions")
    .insert({ feature_id: featureId, user_id: userId });
  if (error && error.code !== "23505") {
    throw new Error(`Failed to follow: ${error.message}`);
  }
  return true;
}

export type NotifyScope = "all" | "following" | "none";

export async function updateNotifyScope(userId: string, scope: NotifyScope) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    const { localGetProfile, localUpsertProfile } = await import("@/lib/data/local-store");
    const existing = localGetProfile(userId);
    if (existing) localUpsertProfile({ ...existing, notifyScope: scope });
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ notify_scope: scope })
    .eq("id", userId);
  if (error) throw new Error(`Failed to save preference: ${error.message}`);
}

const REACTION_LIMIT = { limit: 120, windowMs: 60 * 60_000 };

/**
 * Adds or removes one emoji reaction. Someone may react with several emoji but
 * not twice with the same one — the unique index is what holds that.
 */
export async function toggleReaction(
  entryId: string,
  userId: string,
  emoji: string,
): Promise<boolean> {
  if (!takeToken({ key: `react:${userId}`, ...REACTION_LIMIT })) throw new RateLimited();

  const supabase = getServiceSupabase();
  if (!supabase) return localToggleReaction(entryId, userId, emoji);

  const { data: existing, error: readError } = await supabase
    .from("changelog_reactions")
    .select("id")
    .eq("entry_id", entryId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
    .maybeSingle();
  if (readError) throw new Error(`Failed to read reaction: ${readError.message}`);

  if (existing) {
    const { error } = await supabase
      .from("changelog_reactions")
      .delete()
      .eq("id", existing.id);
    if (error) throw new Error(`Failed to remove reaction: ${error.message}`);
    return false;
  }

  const { error } = await supabase
    .from("changelog_reactions")
    .insert({ entry_id: entryId, user_id: userId, emoji });
  if (error && error.code !== "23505") {
    throw new Error(`Failed to add reaction: ${error.message}`);
  }
  return true;
}

/**
 * Queues the "it shipped" notifications for a feature. Delegates to the
 * `enqueue_shipped_notifications` function so the audience is decided in one
 * place — Phase 3 calls this when an admin marks something shipped.
 */
export async function enqueueShippedNotifications(featureId: string): Promise<number> {
  const supabase = getServiceSupabase();
  if (!supabase) return 0;

  const { data, error } = await supabase.rpc("enqueue_shipped_notifications", {
    target_feature: featureId,
  });
  if (error) throw new Error(`Failed to queue notifications: ${error.message}`);
  return (data as number) ?? 0;
}
