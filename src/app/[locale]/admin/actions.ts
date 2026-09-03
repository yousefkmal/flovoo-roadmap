"use server";

import { revalidatePath } from "next/cache";

import { isLocale, type Locale } from "@/i18n/config";
import { getAdminSession } from "@/lib/auth/admin";
import {
  getChangelogEntryById,
  getFeatureById,
  getSubmissions,
} from "@/lib/data/admin-repository";
import {
  createChangelogEntry,
  createFeature,
  decideSubmission,
  mergeFeatures,
  setFeaturePinned,
  setChangelogPublished,
  setFeatureStatus,
  updateChangelogEntry,
  updateFeature,
  type ChangelogInput,
  type FeatureInput,
} from "@/lib/data/admin-mutations";
import { getCategories } from "@/lib/data/repository";
import {
  CHANGELOG_KINDS,
  FEATURE_STATUSES,
  type ChangelogKind,
  type FeatureStatus,
} from "@/lib/types";
import { isSafeHttpUrl, validateTitle, type FieldError } from "@/lib/validation";

/**
 * Admin actions.
 *
 * Each one resolves the admin session itself. Guarding only the pages would
 * leave these open to anyone who can post to them — a Server Action is a public
 * endpoint whether or not a page renders a button for it.
 */

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("forbidden");
  return session;
}

function revalidateAdmin(locale: Locale) {
  revalidatePath(`/${locale}/admin`, "layout");
  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/updates`);
}

function isStatus(value: string): value is FeatureStatus {
  return (FEATURE_STATUSES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Board manager
// ---------------------------------------------------------------------------

export type MoveState =
  | { status: "ok"; notified: number }
  | { status: "error"; message: string };

export async function moveFeatureAction(
  locale: string,
  featureId: string,
  nextStatus: string,
): Promise<MoveState> {
  if (!isLocale(locale) || !isStatus(nextStatus)) {
    return { status: "error", message: "bad request" };
  }
  await requireAdmin();

  try {
    const feature = await getFeatureById(featureId);
    if (!feature) return { status: "error", message: "not found" };
    if (feature.status === nextStatus) return { status: "ok", notified: 0 };

    const { notified } = await setFeatureStatus(featureId, nextStatus, feature.status);
    revalidateAdmin(locale);
    return { status: "ok", notified };
  } catch (error) {
    console.error("[flovoo] move failed", error);
    return { status: "error", message: "failed" };
  }
}

export async function togglePinAction(locale: string, featureId: string) {
  if (!isLocale(locale)) return { ok: false as const };
  await requireAdmin();

  try {
    const feature = await getFeatureById(featureId);
    if (!feature) return { ok: false as const };
    await setFeaturePinned(featureId, !feature.is_pinned);
    revalidateAdmin(locale);
    return { ok: true as const, pinned: !feature.is_pinned };
  } catch (error) {
    console.error("[flovoo] pin failed", error);
    return { ok: false as const };
  }
}

// ---------------------------------------------------------------------------
// Item editor
// ---------------------------------------------------------------------------

export type EditorState =
  | { status: "idle" }
  | { status: "saved"; featureId: string; notified: number }
  | { status: "invalid"; errors: Partial<Record<"title_ar" | "title_en", FieldError>> }
  | { status: "error"; message: string };

function readFeatureInput(formData: FormData, categoryIds: string[]): FeatureInput {
  const status = String(formData.get("status") ?? "under_review");
  const categoryId = String(formData.get("category_id") ?? "");

  return {
    title_ar: String(formData.get("title_ar") ?? "").trim(),
    title_en: String(formData.get("title_en") ?? "").trim(),
    description_ar: String(formData.get("description_ar") ?? "").trim() || null,
    description_en: String(formData.get("description_en") ?? "").trim() || null,
    status: isStatus(status) ? status : "under_review",
    category_id: categoryIds.includes(categoryId) ? categoryId : null,
    is_pinned: formData.get("is_pinned") === "on",
  };
}

export async function saveFeatureAction(
  locale: string,
  featureId: string | null,
  _prev: EditorState,
  formData: FormData,
): Promise<EditorState> {
  if (!isLocale(locale)) return { status: "error", message: "bad request" };
  await requireAdmin();

  const categories = await getCategories();
  const input = readFeatureInput(formData, categories.map((c) => c.id));

  // Both languages are required: a board that renders half in one language and
  // half in the other is worse than one that refuses to save.
  const errors = {
    title_ar: validateTitle(input.title_ar) ?? undefined,
    title_en: validateTitle(input.title_en) ?? undefined,
  };
  if (errors.title_ar || errors.title_en) return { status: "invalid", errors };

  try {
    if (featureId) {
      const existing = await getFeatureById(featureId);
      if (!existing) return { status: "error", message: "not found" };
      const { notified } = await updateFeature(featureId, input, existing.status);
      revalidateAdmin(locale);
      return { status: "saved", featureId, notified };
    }

    const id = await createFeature(input);
    revalidateAdmin(locale);
    return { status: "saved", featureId: id, notified: 0 };
  } catch (error) {
    console.error("[flovoo] save failed", error);
    return { status: "error", message: "failed" };
  }
}

// ---------------------------------------------------------------------------
// Moderation queue
// ---------------------------------------------------------------------------

export type ModerationState =
  | { status: "idle" }
  | { status: "approved"; featureId: string }
  | { status: "merged" }
  | { status: "rejected" }
  | { status: "invalid"; errors: Partial<Record<"title_ar" | "title_en", FieldError>> }
  | { status: "error"; message: string };

/**
 * Approving turns a submission into a real feature. The admin supplies the
 * missing translation here — a submission arrives in one language only, and
 * publishing it half-translated would break the board for the other half of the
 * audience.
 */
export async function approveSubmissionAction(
  locale: string,
  submissionId: string,
  _prev: ModerationState,
  formData: FormData,
): Promise<ModerationState> {
  if (!isLocale(locale)) return { status: "error", message: "bad request" };
  await requireAdmin();

  const categories = await getCategories();
  const input = readFeatureInput(formData, categories.map((c) => c.id));

  const errors = {
    title_ar: validateTitle(input.title_ar) ?? undefined,
    title_en: validateTitle(input.title_en) ?? undefined,
  };
  if (errors.title_ar || errors.title_en) return { status: "invalid", errors };

  try {
    const featureId = await createFeature({ ...input });
    await decideSubmission(submissionId, {
      status: "approved",
      createdFeature: featureId,
    });
    revalidateAdmin(locale);
    return { status: "approved", featureId };
  } catch (error) {
    console.error("[flovoo] approve failed", error);
    return { status: "error", message: "failed" };
  }
}

export async function mergeSubmissionAction(
  locale: string,
  submissionId: string,
  targetFeatureId: string,
): Promise<ModerationState> {
  if (!isLocale(locale)) return { status: "error", message: "bad request" };
  await requireAdmin();

  try {
    await decideSubmission(submissionId, {
      status: "merged",
      mergedInto: targetFeatureId,
    });
    revalidateAdmin(locale);
    return { status: "merged" };
  } catch (error) {
    console.error("[flovoo] merge submission failed", error);
    return { status: "error", message: "failed" };
  }
}

export async function rejectSubmissionAction(
  locale: string,
  submissionId: string,
  note: string,
): Promise<ModerationState> {
  if (!isLocale(locale)) return { status: "error", message: "bad request" };
  await requireAdmin();

  try {
    await decideSubmission(submissionId, {
      status: "rejected",
      internalNote: note.trim() || null,
    });
    revalidateAdmin(locale);
    return { status: "rejected" };
  } catch (error) {
    console.error("[flovoo] reject failed", error);
    return { status: "error", message: "failed" };
  }
}

// ---------------------------------------------------------------------------
// Changelog manager
// ---------------------------------------------------------------------------

export type ChangelogState =
  | { status: "idle" }
  | { status: "saved"; entryId: string }
  | { status: "invalid"; errors: Partial<Record<"title_ar" | "title_en", FieldError>> }
  | { status: "error"; message: string };

function isKind(value: string): value is ChangelogKind {
  return (CHANGELOG_KINDS as readonly string[]).includes(value);
}

function readChangelogInput(formData: FormData, featureIds: string[]): ChangelogInput {
  const kind = String(formData.get("kind") ?? "new");
  const featureId = String(formData.get("feature_id") ?? "");
  const text = (name: string) => String(formData.get(name) ?? "").trim() || null;

  // Any of these becomes an `href`, so anything that is not plainly http(s) is
  // dropped rather than stored.
  const url = (name: string) => {
    const value = text(name);
    return isSafeHttpUrl(value) ? value : null;
  };

  return {
    kind: isKind(kind) ? kind : "new",
    title_ar: String(formData.get("title_ar") ?? "").trim(),
    title_en: String(formData.get("title_en") ?? "").trim(),
    body_ar: text("body_ar"),
    body_en: text("body_en"),
    image_url: url("image_url"),
    image_alt_ar: text("image_alt_ar"),
    image_alt_en: text("image_alt_en"),
    article_url: url("article_url"),
    action_url: url("action_url"),
    action_label_ar: text("action_label_ar"),
    action_label_en: text("action_label_en"),
    feature_id: featureIds.includes(featureId) ? featureId : null,
  };
}

export async function saveChangelogAction(
  locale: string,
  entryId: string | null,
  _prev: ChangelogState,
  formData: FormData,
): Promise<ChangelogState> {
  if (!isLocale(locale)) return { status: "error", message: "bad request" };
  await requireAdmin();

  const { getAllFeatures } = await import("@/lib/data/admin-repository");
  const features = await getAllFeatures();
  const input = readChangelogInput(formData, features.map((f) => f.id));

  const errors = {
    title_ar: validateTitle(input.title_ar) ?? undefined,
    title_en: validateTitle(input.title_en) ?? undefined,
  };
  if (errors.title_ar || errors.title_en) return { status: "invalid", errors };

  try {
    if (entryId) {
      await updateChangelogEntry(entryId, input);
      revalidateAdmin(locale);
      return { status: "saved", entryId };
    }
    const id = await createChangelogEntry(input);
    revalidateAdmin(locale);
    return { status: "saved", entryId: id };
  } catch (error) {
    console.error("[flovoo] changelog save failed", error);
    return { status: "error", message: "failed" };
  }
}

export async function toggleChangelogPublishedAction(
  locale: string,
  entryId: string,
): Promise<{ ok: boolean; published?: boolean }> {
  if (!isLocale(locale)) return { ok: false };
  await requireAdmin();

  try {
    const entry = await getChangelogEntryById(entryId);
    if (!entry) return { ok: false };
    const next = !entry.is_published;
    await setChangelogPublished(entryId, next, entry.published_at);
    revalidateAdmin(locale);
    return { ok: true, published: next };
  } catch (error) {
    console.error("[flovoo] publish toggle failed", error);
    return { ok: false };
  }
}

/** Folds one board item into another, moving its votes. */
export async function mergeFeaturesAction(
  locale: string,
  sourceId: string,
  targetId: string,
): Promise<{ ok: boolean }> {
  if (!isLocale(locale)) return { ok: false };
  await requireAdmin();

  try {
    await mergeFeatures(sourceId, targetId);
    revalidateAdmin(locale);
    return { ok: true };
  } catch (error) {
    console.error("[flovoo] merge features failed", error);
    return { ok: false };
  }
}

export { getSubmissions };
