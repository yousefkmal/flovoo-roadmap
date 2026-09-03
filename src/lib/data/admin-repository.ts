import "server-only";

import {
  localChangelogState,
  localFeatureState,
  localSubmissionDecision,
  localSubmissions,
} from "@/lib/data/local-store";
import { CATEGORIES, CHANGELOG_ENTRIES, FEATURES } from "@/lib/data/seed";
import { getServiceSupabase } from "@/lib/data/supabase-admin";
import type {
  Category,
  ChangelogEntry,
  Feature,
  FeatureStatus,
  FeatureWithCategory,
} from "@/lib/types";

/**
 * Reads for the admin side. Separate from the public repository because the
 * questions are different: admins see archived items, unmoderated submissions,
 * and the internal notes on them — none of which the public path should ever be
 * able to return by accident.
 */

export interface AdminSubmission {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  submitterName: string;
  submitterEmail: string;
  language: "ar" | "en";
  status: "pending" | "approved" | "merged" | "rejected";
  internalNote: string | null;
  mergedInto: string | null;
  createdAt: string;
}

function withCategory(features: Feature[], categories: Category[]): FeatureWithCategory[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return features.map((feature) => ({
    ...feature,
    category: feature.category_id ? (byId.get(feature.category_id) ?? null) : null,
  }));
}

/** Everything, archived included — the admin board has an Archived column. */
export async function getAllFeatures(): Promise<FeatureWithCategory[]> {
  const supabase = getServiceSupabase();

  if (!supabase) {
    const all = localFeatureState(FEATURES);
    return withCategory(
      all.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        if (a.vote_count !== b.vote_count) return b.vote_count - a.vote_count;
        return Date.parse(b.created_at) - Date.parse(a.created_at);
      }),
      [...CATEGORIES].sort((a, b) => a.sort_order - b.sort_order),
    );
  }

  const [{ data: features, error }, { data: categories, error: catError }] =
    await Promise.all([
      supabase
        .from("features")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("vote_count", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("sort_order"),
    ]);
  if (error) throw new Error(`Failed to load features: ${error.message}`);
  if (catError) throw new Error(`Failed to load categories: ${catError.message}`);

  return withCategory(features as Feature[], categories as Category[]);
}

export async function getFeatureById(id: string): Promise<FeatureWithCategory | null> {
  const all = await getAllFeatures();
  return all.find((feature) => feature.id === id) ?? null;
}

export async function getSubmissions(
  status: AdminSubmission["status"] | "all" = "pending",
): Promise<AdminSubmission[]> {
  const supabase = getServiceSupabase();

  if (!supabase) {
    return localSubmissions()
      .map((submission): AdminSubmission => {
        const decision = localSubmissionDecision(submission.id);
        return {
          id: submission.id,
          title: submission.title,
          description: submission.description,
          categoryId: submission.categoryId,
          submitterName: submission.submitterName,
          submitterEmail: submission.submitterEmail,
          language: submission.language,
          status: decision?.status ?? "pending",
          internalNote: decision?.internalNote ?? null,
          mergedInto: decision?.mergedInto ?? null,
          createdAt: submission.createdAt,
        };
      })
      .filter((submission) => status === "all" || submission.status === status)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  let query = supabase
    .from("submissions")
    .select("*")
    .order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load submissions: ${error.message}`);

  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    categoryId: (row.category_id as string) ?? null,
    submitterName: row.submitter_name as string,
    submitterEmail: row.submitter_email as string,
    language: row.language as "ar" | "en",
    status: row.status as AdminSubmission["status"],
    internalNote: (row.internal_note as string) ?? null,
    mergedInto: (row.merged_into as string) ?? null,
    createdAt: row.created_at as string,
  }));
}

/** The badge in the admin nav. Cheap enough to call on every admin render. */
export async function getPendingSubmissionCount(): Promise<number> {
  const supabase = getServiceSupabase();
  if (!supabase) return (await getSubmissions("pending")).length;

  const { count, error } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw new Error(`Failed to count submissions: ${error.message}`);
  return count ?? 0;
}

/**
 * Drafts first, then newest published last-to-first.
 *
 * A draft has no `published_at`, so it has no date to sort by. Falling back to
 * the id would hand `Date.parse` a UUID, get NaN, and leave `sort` with no
 * ordering at all — drafts then land wherever the sort happens to drop them,
 * differing between two loads of the same list.
 */
function byDraftThenNewest(a: ChangelogEntry, b: ChangelogEntry): number {
  if (a.is_published !== b.is_published) return a.is_published ? 1 : -1;
  const dateA = a.published_at ? Date.parse(a.published_at) : 0;
  const dateB = b.published_at ? Date.parse(b.published_at) : 0;
  return dateB - dateA || a.id.localeCompare(b.id);
}

/** Every entry, drafts included — the manager's whole job is the unpublished ones. */
export async function getAllChangelogEntries(): Promise<ChangelogEntry[]> {
  const supabase = getServiceSupabase();

  if (!supabase) {
    return localChangelogState(CHANGELOG_ENTRIES).sort(byDraftThenNewest);
  }

  const { data, error } = await supabase
    .from("changelog_entries")
    .select("*")
    .order("is_published", { ascending: true })
    .order("published_at", { ascending: false, nullsFirst: true })
    .order("id", { ascending: true });
  if (error) throw new Error(`Failed to load changelog: ${error.message}`);
  return data as ChangelogEntry[];
}

export async function getChangelogEntryById(
  id: string,
): Promise<ChangelogEntry | null> {
  const all = await getAllChangelogEntries();
  return all.find((entry) => entry.id === id) ?? null;
}

export interface AdminStats {
  totalVotes: number;
  liveFeatures: number;
  pendingSubmissions: number;
  submissionsThisMonth: number;
  topVoted: { id: string; titleAr: string; titleEn: string; votes: number }[];
}

/**
 * The numbers on the admin board. Derived from what is already loaded rather
 * than queried separately — the board reads every feature anyway, and a second
 * round trip to count rows it is holding would be waste.
 */
export async function getAdminStats(
  features: FeatureWithCategory[],
): Promise<AdminStats> {
  const live = features.filter((feature) => feature.status !== "archived");

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const supabase = getServiceSupabase();
  let pending: number;
  let thisMonth: number;

  if (!supabase) {
    const all = await getSubmissions("all");
    pending = all.filter((s) => s.status === "pending").length;
    thisMonth = all.filter(
      (s) => Date.parse(s.createdAt) >= startOfMonth.getTime(),
    ).length;
  } else {
    const [pendingResult, monthResult] = await Promise.all([
      supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfMonth.toISOString()),
    ]);
    if (pendingResult.error) throw new Error(pendingResult.error.message);
    if (monthResult.error) throw new Error(monthResult.error.message);
    pending = pendingResult.count ?? 0;
    thisMonth = monthResult.count ?? 0;
  }

  return {
    totalVotes: live.reduce((sum, feature) => sum + feature.vote_count, 0),
    liveFeatures: live.length,
    pendingSubmissions: pending,
    submissionsThisMonth: thisMonth,
    topVoted: [...live]
      .sort((a, b) => b.vote_count - a.vote_count)
      .slice(0, 5)
      .map((feature) => ({
        id: feature.id,
        titleAr: feature.title_ar,
        titleEn: feature.title_en,
        votes: feature.vote_count,
      })),
  };
}

export const ADMIN_STATUSES: FeatureStatus[] = [
  "under_review",
  "planned",
  "in_progress",
  "shipped",
  "archived",
];
