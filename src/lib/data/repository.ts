import "server-only";

import { CATEGORIES, CHANGELOG_ENTRIES, FEATURES } from "@/lib/data/seed";
import {
  localChangelogState,
  localFeatureState,
  localFollowedFeatureIds,
  localReactions,
  localVotedFeatureIds,
} from "@/lib/data/local-store";
import { getSupabase } from "@/lib/data/supabase";
import { getServiceSupabase } from "@/lib/data/supabase-admin";
import {
  BOARD_STATUSES,
  type Category,
  type ChangelogEntry,
  type Feature,
  type FeatureWithCategory,
} from "@/lib/types";

/**
 * The single read path for public content. Backed by Supabase when it is
 * configured, and by `seed.ts` otherwise, so the UI never has to care which.
 *
 * Everything here is read-only: voting and submissions arrive in Phase 2.
 */

const BOARD_STATUS_SET = new Set<string>(BOARD_STATUSES);

/** Pinned first, then most-voted, then newest — matches `features_board_order_idx`. */
function byBoardOrder(a: Feature, b: Feature): number {
  if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
  if (a.vote_count !== b.vote_count) return b.vote_count - a.vote_count;
  return Date.parse(b.created_at) - Date.parse(a.created_at);
}

function withCategory(
  features: Feature[],
  categories: Category[],
): FeatureWithCategory[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return features.map((feature) => ({
    ...feature,
    category: feature.category_id ? (byId.get(feature.category_id) ?? null) : null,
  }));
}

export async function getCategories(): Promise<Category[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return [...CATEGORIES].sort((a, b) => a.sort_order - b.sort_order);
  }

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return data as Category[];
}

/** The four board columns. Archived items are excluded by design. */
export async function getBoardFeatures(): Promise<FeatureWithCategory[]> {
  const categories = await getCategories();
  const supabase = getSupabase();

  if (!supabase) {
    // The seed plus every local change — votes, admin edits, admin-created
    // features — so this and the admin board never disagree.
    const features = localFeatureState(FEATURES)
      .filter((f) => BOARD_STATUS_SET.has(f.status))
      .sort(byBoardOrder);
    return withCategory(features, categories);
  }

  const { data, error } = await supabase
    .from("features")
    .select("*")
    .in("status", [...BOARD_STATUSES])
    .order("is_pinned", { ascending: false })
    .order("vote_count", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load the board: ${error.message}`);
  return withCategory(data as Feature[], categories);
}

export async function getShippedFeatures(): Promise<FeatureWithCategory[]> {
  const categories = await getCategories();
  const supabase = getSupabase();

  if (!supabase) {
    const features = localFeatureState(FEATURES)
      .filter((f) => f.status === "shipped")
      .sort((a, b) => Date.parse(b.shipped_at ?? "") - Date.parse(a.shipped_at ?? ""));
    return withCategory(features, categories);
  }

  const { data, error } = await supabase
    .from("features")
    .select("*")
    .eq("status", "shipped")
    .order("shipped_at", { ascending: false });
  if (error) throw new Error(`Failed to load shipped features: ${error.message}`);
  return withCategory(data as Feature[], categories);
}

/**
 * The features this visitor has voted for.
 *
 * Read with the service key: the `votes` policies deliberately keep
 * who-voted-for-what unreadable by the anon role, so the server does this on
 * the person's behalf using the user id from their session.
 */
export async function getVotedFeatureIds(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();

  const supabase = getServiceSupabase();
  if (!supabase) return new Set(localVotedFeatureIds(userId));

  const { data, error } = await supabase
    .from("votes")
    .select("feature_id")
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to load votes: ${error.message}`);
  return new Set((data as { feature_id: string }[]).map((row) => row.feature_id));
}

/** The features this visitor asked to be told about. */
export async function getFollowedFeatureIds(
  userId: string | null,
): Promise<Set<string>> {
  if (!userId) return new Set();

  const supabase = getServiceSupabase();
  if (!supabase) return new Set(localFollowedFeatureIds(userId));

  const { data, error } = await supabase
    .from("feature_subscriptions")
    .select("feature_id")
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to load follows: ${error.message}`);
  return new Set((data as { feature_id: string }[]).map((row) => row.feature_id));
}

export async function getPublishedChangelog(): Promise<ChangelogEntry[]> {
  const supabase = getSupabase();

  if (!supabase) {
    return localChangelogState(CHANGELOG_ENTRIES)
      .filter((e) => e.is_published)
      .sort((a, b) => Date.parse(b.published_at ?? "") - Date.parse(a.published_at ?? ""));
  }

  const { data, error } = await supabase
    .from("changelog_entries")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false });
  if (error) throw new Error(`Failed to load the changelog: ${error.message}`);
  return data as ChangelogEntry[];
}

export interface ReactionTally {
  emoji: string;
  count: number;
  /** Whether the person asking is among them. */
  mine: boolean;
}

/**
 * Reaction tallies for a set of entries, in one round trip rather than one per
 * entry. Counts are public; whose reaction is whose is only resolved for the
 * person asking.
 */
export async function getReactions(
  entryIds: string[],
  userId: string | null,
): Promise<Map<string, ReactionTally[]>> {
  const result = new Map<string, ReactionTally[]>();
  if (entryIds.length === 0) return result;

  const supabase = getServiceSupabase();

  if (!supabase) {
    for (const id of entryIds) {
      const tallies = localReactions(id).map(({ emoji, count, userIds }) => ({
        emoji,
        count,
        mine: userId ? userIds.includes(userId) : false,
      }));
      if (tallies.length) result.set(id, tallies);
    }
    return result;
  }

  const { data, error } = await supabase
    .from("changelog_reactions")
    .select("entry_id, emoji, user_id")
    .in("entry_id", entryIds);
  if (error) throw new Error(`Failed to load reactions: ${error.message}`);

  const rows = data as { entry_id: string; emoji: string; user_id: string }[];
  const grouped = new Map<string, Map<string, { count: number; mine: boolean }>>();
  for (const row of rows) {
    const byEmoji = grouped.get(row.entry_id) ?? new Map();
    const tally = byEmoji.get(row.emoji) ?? { count: 0, mine: false };
    tally.count += 1;
    if (userId && row.user_id === userId) tally.mine = true;
    byEmoji.set(row.emoji, tally);
    grouped.set(row.entry_id, byEmoji);
  }

  for (const [entryId, byEmoji] of grouped) {
    result.set(
      entryId,
      [...byEmoji.entries()]
        .map(([emoji, tally]) => ({ emoji, ...tally }))
        .sort((a, b) => b.count - a.count),
    );
  }
  return result;
}
