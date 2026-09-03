import "server-only";

import { randomUUID } from "node:crypto";

import {
  localAddChangelog,
  localAddFeature,
  localDecideSubmission,
  localHasChangelogForFeature,
  localMergeVotes,
  localPatchChangelog,
  localPatchFeature,
} from "@/lib/data/local-store";
import { CHANGELOG_ENTRIES } from "@/lib/data/seed";
import { enqueueShippedNotifications } from "@/lib/data/mutations";
import { getServiceSupabase } from "@/lib/data/supabase-admin";
import type { ChangelogKind, FeatureStatus } from "@/lib/types";

/**
 * Admin writes. Every one of these is called only from an action that has
 * already resolved an admin session — the guard lives there, not here, so this
 * module stays about *what* changes rather than *who may*.
 */

export interface FeatureInput {
  title_ar: string;
  title_en: string;
  description_ar: string | null;
  description_en: string | null;
  status: FeatureStatus;
  category_id: string | null;
  is_pinned: boolean;
}

/**
 * Shipping is the one status change with a consequence beyond the board: it is
 * what people asked to be told about. Returning the count lets the caller say
 * how many were queued rather than guessing.
 */
async function onShipped(featureId: string): Promise<number> {
  // Drafting first: an admin who ships something should find the changelog
  // entry waiting rather than have to remember to write one.
  try {
    await draftChangelogForFeature(featureId);
  } catch (error) {
    console.error("[flovoo] drafting changelog entry failed", error);
  }

  try {
    return await enqueueShippedNotifications(featureId);
  } catch (error) {
    // A notification failure must not roll back the status change; the outbox
    // can be refilled, an admin's edit being silently lost cannot.
    console.error("[flovoo] queuing shipped notifications failed", error);
    return 0;
  }
}

/**
 * Drafts an unpublished changelog entry from a feature that just shipped.
 *
 * Unpublished on purpose: the draft is a starting point, not an announcement.
 * Nothing reaches the Updates tab until an admin has read it and pressed
 * publish. Idempotent — shipping, unshipping and shipping again drafts once.
 */
export async function draftChangelogForFeature(featureId: string): Promise<void> {
  const supabase = getServiceSupabase();

  if (!supabase) {
    const { FEATURES } = await import("@/lib/data/seed");
    const { localFeatureState } = await import("@/lib/data/local-store");
    if (localHasChangelogForFeature(CHANGELOG_ENTRIES, featureId)) return;

    const feature = localFeatureState(FEATURES).find((f) => f.id === featureId);
    if (!feature) return;

    localAddChangelog({
      id: randomUUID(),
      feature_id: featureId,
      kind: "new",
      title_ar: feature.title_ar,
      title_en: feature.title_en,
      body_ar: feature.description_ar,
      body_en: feature.description_en,
      image_url: null,
      image_alt_ar: null,
      image_alt_en: null,
      article_url: null,
      action_url: null,
      action_label_ar: null,
      action_label_en: null,
      is_published: false,
      published_at: null,
    });
    return;
  }

  const { data: existing } = await supabase
    .from("changelog_entries")
    .select("id")
    .eq("feature_id", featureId)
    .maybeSingle();
  if (existing) return;

  const { data: feature, error } = await supabase
    .from("features")
    .select("title_ar, title_en, description_ar, description_en")
    .eq("id", featureId)
    .single();
  if (error || !feature) return;

  await supabase.from("changelog_entries").insert({
    feature_id: featureId,
    kind: "new",
    title_ar: feature.title_ar,
    title_en: feature.title_en,
    body_ar: feature.description_ar,
    body_en: feature.description_en,
    is_published: false,
  });
}

// ---------------------------------------------------------------------------
// Changelog manager
// ---------------------------------------------------------------------------

export interface ChangelogInput {
  kind: ChangelogKind;
  title_ar: string;
  title_en: string;
  body_ar: string | null;
  body_en: string | null;
  image_url: string | null;
  image_alt_ar: string | null;
  image_alt_en: string | null;
  article_url: string | null;
  action_url: string | null;
  action_label_ar: string | null;
  action_label_en: string | null;
  feature_id: string | null;
}

export async function createChangelogEntry(input: ChangelogInput): Promise<string> {
  const supabase = getServiceSupabase();

  if (!supabase) {
    const id = randomUUID();
    localAddChangelog({ ...input, id, is_published: false, published_at: null });
    return id;
  }

  const { data, error } = await supabase
    .from("changelog_entries")
    .insert({ ...input, is_published: false })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create entry: ${error.message}`);
  return data.id as string;
}

export async function updateChangelogEntry(
  id: string,
  input: ChangelogInput,
): Promise<void> {
  const supabase = getServiceSupabase();

  if (!supabase) {
    localPatchChangelog(id, { ...input });
    return;
  }

  const { error } = await supabase.from("changelog_entries").update(input).eq("id", id);
  if (error) throw new Error(`Failed to update entry: ${error.message}`);
}

/**
 * Publishing stamps `published_at`; the table's own check constraint requires
 * one whenever `is_published` is true, so the two always move together.
 */
export async function setChangelogPublished(
  id: string,
  published: boolean,
  existingPublishedAt: string | null,
): Promise<void> {
  const supabase = getServiceSupabase();
  const publishedAt = published ? (existingPublishedAt ?? new Date().toISOString()) : null;

  if (!supabase) {
    localPatchChangelog(id, { is_published: published, published_at: publishedAt });
    return;
  }

  const { error } = await supabase
    .from("changelog_entries")
    .update({ is_published: published, published_at: publishedAt })
    .eq("id", id);
  if (error) throw new Error(`Failed to publish: ${error.message}`);
}

export async function createFeature(input: FeatureInput): Promise<string> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();
  const shippedAt = input.status === "shipped" ? now : null;

  if (!supabase) {
    const id = randomUUID();
    localAddFeature({
      id,
      ...input,
      vote_count: 0,
      source: "internal",
      submitted_by_name: null,
      shipped_at: shippedAt,
      created_at: now,
      updated_at: now,
    });
    if (input.status === "shipped") await onShipped(id);
    return id;
  }

  const { data, error } = await supabase
    .from("features")
    .insert({ ...input, source: "internal", shipped_at: shippedAt })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create feature: ${error.message}`);

  const id = data.id as string;
  if (input.status === "shipped") await onShipped(id);
  return id;
}

export async function updateFeature(
  id: string,
  input: FeatureInput,
  previousStatus: FeatureStatus,
): Promise<{ notified: number }> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();
  const becameShipped = input.status === "shipped" && previousStatus !== "shipped";
  // Set on the way in, cleared on the way out — the check constraint requires a
  // timestamp whenever the status is shipped.
  const shippedAt =
    input.status === "shipped" ? now : input.status === "archived" ? undefined : null;

  if (!supabase) {
    localPatchFeature(id, {
      ...input,
      ...(shippedAt !== undefined ? { shipped_at: shippedAt } : {}),
      updated_at: now,
    });
    return { notified: becameShipped ? await onShipped(id) : 0 };
  }

  const { error } = await supabase
    .from("features")
    .update({
      ...input,
      ...(shippedAt !== undefined ? { shipped_at: shippedAt } : {}),
    })
    .eq("id", id);
  if (error) throw new Error(`Failed to update feature: ${error.message}`);

  return { notified: becameShipped ? await onShipped(id) : 0 };
}

/** Status-only change, for dragging a card between columns. */
export async function setFeatureStatus(
  id: string,
  status: FeatureStatus,
  previousStatus: FeatureStatus,
): Promise<{ notified: number }> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();
  const becameShipped = status === "shipped" && previousStatus !== "shipped";
  const shippedAt = status === "shipped" ? now : status === "archived" ? undefined : null;

  if (!supabase) {
    localPatchFeature(id, {
      status,
      ...(shippedAt !== undefined ? { shipped_at: shippedAt } : {}),
      updated_at: now,
    });
    return { notified: becameShipped ? await onShipped(id) : 0 };
  }

  const { error } = await supabase
    .from("features")
    .update({ status, ...(shippedAt !== undefined ? { shipped_at: shippedAt } : {}) })
    .eq("id", id);
  if (error) throw new Error(`Failed to move feature: ${error.message}`);

  return { notified: becameShipped ? await onShipped(id) : 0 };
}

export async function setFeaturePinned(id: string, pinned: boolean): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    localPatchFeature(id, { is_pinned: pinned, updated_at: new Date().toISOString() });
    return;
  }
  const { error } = await supabase
    .from("features")
    .update({ is_pinned: pinned })
    .eq("id", id);
  if (error) throw new Error(`Failed to pin feature: ${error.message}`);
}

/**
 * Folds one feature into another: votes the target does not already have move
 * across, submissions repoint, and the duplicate is archived rather than
 * deleted — an archived row keeps the history, a deleted one loses it.
 */
export async function mergeFeatures(sourceId: string, targetId: string): Promise<void> {
  if (sourceId === targetId) throw new Error("Cannot merge a feature into itself");

  const supabase = getServiceSupabase();
  if (!supabase) {
    localMergeVotes(sourceId, targetId);
    localPatchFeature(sourceId, {
      status: "archived",
      updated_at: new Date().toISOString(),
    });
    return;
  }

  // One round trip, and the whole fold happens inside a single statement — see
  // `merge_features` in the migration.
  const { error } = await supabase.rpc("merge_features", {
    source_id: sourceId,
    target_id: targetId,
  });
  if (error) throw new Error(`Failed to merge: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

export async function decideSubmission(
  id: string,
  decision: {
    status: "approved" | "merged" | "rejected";
    internalNote?: string | null;
    mergedInto?: string | null;
    createdFeature?: string | null;
  },
): Promise<void> {
  const supabase = getServiceSupabase();

  if (!supabase) {
    localDecideSubmission(id, {
      status: decision.status,
      internalNote: decision.internalNote ?? null,
      mergedInto: decision.mergedInto ?? null,
      createdFeature: decision.createdFeature ?? null,
      decidedAt: new Date().toISOString(),
    });
    return;
  }

  const { error } = await supabase
    .from("submissions")
    .update({
      status: decision.status,
      internal_note: decision.internalNote ?? null,
      merged_into: decision.mergedInto ?? null,
      created_feature: decision.createdFeature ?? null,
    })
    .eq("id", id);
  if (error) throw new Error(`Failed to record decision: ${error.message}`);
}
