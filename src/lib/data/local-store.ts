import "server-only";

/**
 * Writes for local development, when Supabase is not configured.
 *
 * Process memory, on purpose: it makes the portal fully usable — vote, unvote,
 * submit — without any setup, and it is obvious that it resets when the server
 * does. Configure Supabase and none of this is reached.
 */

/** feature id → the user ids that voted for it. */
const votesByFeature = new Map<string, Set<string>>();

export interface LocalProfile {
  id: string;
  email: string;
  name: string | null;
  notifyScope: "all" | "following" | "none";
  locale: "ar" | "en";
}

const profiles = new Map<string, LocalProfile>();

/** user id → the feature ids they asked to be told about. */
const followsByUser = new Map<string, Set<string>>();

export function localGetProfile(userId: string): LocalProfile | null {
  return profiles.get(userId) ?? null;
}

export function localUpsertProfile(profile: LocalProfile) {
  profiles.set(profile.id, { ...profiles.get(profile.id), ...profile });
}

export function localToggleFollow(userId: string, featureId: string): boolean {
  const follows = followsByUser.get(userId) ?? new Set<string>();
  const following = follows.has(featureId);
  if (following) follows.delete(featureId);
  else follows.add(featureId);
  followsByUser.set(userId, follows);
  return !following;
}

export function localFollowedFeatureIds(userId: string): string[] {
  return [...(followsByUser.get(userId) ?? [])];
}

export interface LocalSubmission {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  submitterName: string;
  submitterEmail: string;
  language: "ar" | "en";
  createdAt: string;
}

const submissions: LocalSubmission[] = [];

export function localToggleVote(featureId: string, voterId: string): boolean {
  const voters = votesByFeature.get(featureId) ?? new Set<string>();
  const voted = voters.has(voterId);
  if (voted) voters.delete(voterId);
  else voters.add(voterId);
  votesByFeature.set(featureId, voters);
  return !voted;
}

/** How far this feature's count has moved from its seed value. */
export function localVoteDelta(featureId: string): number {
  return votesByFeature.get(featureId)?.size ?? 0;
}

export function localVotedFeatureIds(voterId: string): string[] {
  const ids: string[] = [];
  for (const [featureId, voters] of votesByFeature) {
    if (voters.has(voterId)) ids.push(featureId);
  }
  return ids;
}

/** entry id → emoji → the user ids who reacted with it. */
const reactionsByEntry = new Map<string, Map<string, Set<string>>>();

export function localToggleReaction(
  entryId: string,
  userId: string,
  emoji: string,
): boolean {
  const byEmoji = reactionsByEntry.get(entryId) ?? new Map<string, Set<string>>();
  const users = byEmoji.get(emoji) ?? new Set<string>();
  const reacted = users.has(userId);
  if (reacted) users.delete(userId);
  else users.add(userId);
  byEmoji.set(emoji, users);
  reactionsByEntry.set(entryId, byEmoji);
  return !reacted;
}

export function localReactions(
  entryId: string,
): { emoji: string; count: number; userIds: string[] }[] {
  const byEmoji = reactionsByEntry.get(entryId);
  if (!byEmoji) return [];
  return [...byEmoji.entries()]
    .filter(([, users]) => users.size > 0)
    .map(([emoji, users]) => ({ emoji, count: users.size, userIds: [...users] }));
}

// ---------------------------------------------------------------------------
// Admin edits, for development without Supabase
// ---------------------------------------------------------------------------
// Seed features are a frozen array, so edits are kept as overrides layered on
// top rather than by mutating it. Created features live alongside.

export interface FeaturePatch {
  title_ar?: string;
  title_en?: string;
  description_ar?: string | null;
  description_en?: string | null;
  status?: string;
  category_id?: string | null;
  is_pinned?: boolean;
  shipped_at?: string | null;
  updated_at?: string;
}

const featurePatches = new Map<string, FeaturePatch>();
const createdFeatures: Record<string, unknown>[] = [];

export function localPatchFeature(id: string, patch: FeaturePatch) {
  featurePatches.set(id, { ...featurePatches.get(id), ...patch });
}

export function localFeaturePatch(id: string): FeaturePatch | undefined {
  return featurePatches.get(id);
}

export function localAddFeature(feature: Record<string, unknown>) {
  createdFeatures.push(feature);
}

export function localCreatedFeatures(): readonly Record<string, unknown>[] {
  return createdFeatures;
}

/**
 * The seed with every local change layered on: admin edits, admin-created
 * features, and vote deltas.
 *
 * Both repositories go through this. They used to each merge their own subset,
 * which meant an admin could edit a feature, see it change on the admin board,
 * and not see it change on the public one.
 */
export function localFeatureState<T extends { id: string; vote_count: number }>(
  seed: readonly T[],
): T[] {
  return [...seed, ...(createdFeatures as unknown as T[])].map((feature) => ({
    ...feature,
    ...(featurePatches.get(feature.id) as Partial<T> | undefined),
    vote_count: feature.vote_count + localVoteDelta(feature.id),
  }));
}

// Changelog entries follow the same shape as features: the seed is frozen, so
// edits are overrides layered on top and new entries live alongside.

const changelogPatches = new Map<string, Record<string, unknown>>();
const createdChangelog: Record<string, unknown>[] = [];

export function localPatchChangelog(id: string, patch: Record<string, unknown>) {
  changelogPatches.set(id, { ...changelogPatches.get(id), ...patch });
}

export function localAddChangelog(entry: Record<string, unknown>) {
  createdChangelog.push(entry);
}

export function localChangelogState<T extends { id: string }>(seed: readonly T[]): T[] {
  return [...seed, ...(createdChangelog as unknown as T[])].map((entry) => ({
    ...entry,
    ...(changelogPatches.get(entry.id) as Partial<T> | undefined),
  }));
}

/** Whether a feature already has an entry, so shipping twice drafts once. */
export function localHasChangelogForFeature(
  seed: readonly { id: string; feature_id: string | null }[],
  featureId: string,
): boolean {
  return localChangelogState(seed).some((entry) => entry.feature_id === featureId);
}

/** Submission id → the moderation decision taken on it. */
export interface SubmissionDecision {
  status: "approved" | "merged" | "rejected";
  internalNote: string | null;
  mergedInto: string | null;
  createdFeature: string | null;
  decidedAt: string;
}

const submissionDecisions = new Map<string, SubmissionDecision>();

export function localDecideSubmission(id: string, decision: SubmissionDecision) {
  submissionDecisions.set(id, decision);
}

export function localSubmissionDecision(id: string): SubmissionDecision | undefined {
  return submissionDecisions.get(id);
}

/** Moves every vote on `sourceId` to `targetId` that the target lacks. */
export function localMergeVotes(sourceId: string, targetId: string): number {
  const source = votesByFeature.get(sourceId);
  if (!source) return 0;
  const target = votesByFeature.get(targetId) ?? new Set<string>();
  let moved = 0;
  for (const voter of source) {
    if (!target.has(voter)) {
      target.add(voter);
      moved += 1;
    }
  }
  votesByFeature.set(targetId, target);
  votesByFeature.delete(sourceId);
  return moved;
}

export function localAddSubmission(submission: LocalSubmission) {
  submissions.push(submission);
}

/** Count in a window, so the same email cannot flood the moderation queue. */
export function localSubmissionCount(email: string, sinceMs: number): number {
  const cutoff = Date.now() - sinceMs;
  const needle = email.trim().toLowerCase();
  return submissions.filter(
    (s) => s.submitterEmail.toLowerCase() === needle && Date.parse(s.createdAt) >= cutoff,
  ).length;
}

/** Read-only view, for the Phase 3 moderation queue to build on. */
export function localSubmissions(): readonly LocalSubmission[] {
  return submissions;
}
