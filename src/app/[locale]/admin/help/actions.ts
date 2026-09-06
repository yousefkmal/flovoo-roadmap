"use server";

import { summaryBlocksPublish } from "@/lib/help/geo";
import { articleUrls, pingIndexNow } from "@/lib/help/indexnow";
import { revalidatePath } from "next/cache";

import { HELP_ICONS } from "@/components/help/CollectionIcon";
import { isLocale, type Locale } from "@/i18n/config";
import { getAdminSession } from "@/lib/auth/admin";
import {
  CollectionNotEmpty,
  SlugTaken,
  deleteHelpCollection,
  deleteHelpMedia,
  deleteHelpRedirect,
  reorderHelpCollections,
  saveHelpArticle,
  saveHelpCollection,
  setHelpArticlesStatus,
  updateHelpMediaAlt,
  upsertHelpRedirects,
  type HelpArticleInput,
  type HelpRedirectInput,
  type HelpTranslationInput,
} from "@/lib/data/help-admin-mutations";
import {
  getAdminHelpArticle,
  getAdminHelpCollections,
  getAdminHelpMedia,
  getAdminHelpMediaById,
} from "@/lib/data/help-admin-repository";
import { dismissContentGap } from "@/lib/data/help-analytics-mutations";
import { syncArticleChunks } from "@/lib/help/chunks";
import { countNodes, toPlainText, type BlockDocument, type BlockNode } from "@/lib/help/blocks";
import { HELP_ARTICLE_STATUSES, type HelpArticleStatus } from "@/lib/help/types";

/**
 * Help-center admin actions. Each one resolves the admin session itself — a
 * Server Action is a public endpoint whether or not a page renders a button
 * for it — and re-validates its input; the editor's own checks are for
 * instant feedback and are trivially bypassed.
 */

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("forbidden");
  return session;
}

/**
 * Publishing must be visible within seconds (brief §13). Every help page is
 * static with ISR, so a write invalidates the whole help segment in both
 * languages — a topic rename touches the sidebar on every page anyway.
 */
function revalidateHelp(locale: Locale) {
  revalidatePath("/[locale]/help", "layout");
  revalidatePath(`/${locale}/admin/help`, "layout");
  revalidatePath("/sitemap/ar.xml");
  revalidatePath("/sitemap/en.xml");
  // The machine-readable corpus is generated, so it goes stale with the pages.
  revalidatePath("/llms.txt");
  revalidatePath("/llms-full.txt");
}

/**
 * Tells Bing what changed. Never awaited into the caller's failure path: a
 * search engine being slow or down must not fail somebody's save.
 */
function announce(urls: string[]) {
  void pingIndexNow(urls).catch((error) => {
    console.warn("[flovoo] indexnow ping failed", error);
  });
}

export type HelpFieldError =
  | "required"
  | "tooLong"
  | "invalidSlug"
  | "slugTaken"
  | "unknownCollection"
  | "sectionBoth"
  | "bodyEmpty"
  | "invalidIcon"
  | "altMissing"
  | "summaryLength"
  | "invalidPath"
  | "samePath";

const SLUG = /^[^\s/?#%]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isStatus(value: unknown): value is HelpArticleStatus {
  return typeof value === "string" && (HELP_ARTICLE_STATUSES as readonly string[]).includes(value);
}

function isBlockDocument(value: unknown): value is BlockDocument {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "doc" &&
    Array.isArray((value as { content?: unknown }).content)
  );
}

/**
 * A figure a reader would meet without a usable description: none at all, or
 * one that was generated and never reviewed. Both block publishing; neither
 * blocks saving a draft.
 */
function figureWithoutAlt(node: BlockNode): boolean {
  if (node.type === "figure") {
    if (!String(node.attrs?.alt ?? "").trim()) return true;
    if (node.attrs?.altDraft === true) return true;
  }
  return (node.content ?? []).some(figureWithoutAlt);
}

function text(value: unknown, max: number): { value: string | null; error?: HelpFieldError } {
  if (typeof value !== "string") return { value: null };
  const trimmed = value.trim();
  if (!trimmed) return { value: null };
  if (trimmed.length > max) return { value: trimmed, error: "tooLong" };
  return { value: trimmed };
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export interface HelpTranslationPayload {
  slug: string;
  title: string;
  excerpt: string;
  body: unknown;
  meta_title: string;
  meta_description: string;
  /** Phase 7B: the fields that decide whether a passage can be extracted. */
  answer_summary: string;
  question_title: string;
  key_facts: string[];
}

export interface HelpArticlePayload {
  collection_id: string;
  status: string;
  is_pinned: boolean;
  sort_order: number;
  section_ar: string;
  section_en: string;
  icon: string;
  translations: { ar: HelpTranslationPayload; en: HelpTranslationPayload | null };
}

export type SaveHelpArticleState =
  | { status: "ok"; id: string }
  | { status: "invalid"; errors: Record<string, HelpFieldError> }
  | { status: "error" };

/** Whether an English tab with nothing typed in it should count as "no translation". */
function isBlankTranslation(t: HelpTranslationPayload | null): boolean {
  if (!t) return true;
  const bodyText = isBlockDocument(t.body) ? toPlainText(t.body).trim() : "";
  const hasMedia = isBlockDocument(t.body) && (countNodes(t.body, "figure") + countNodes(t.body, "video")) > 0;
  return !t.title.trim() && !t.slug.trim() && !bodyText && !hasMedia;
}

function validateTranslation(
  prefix: "ar" | "en",
  t: HelpTranslationPayload,
  errors: Record<string, HelpFieldError>,
  /**
   * Alt text is required to publish, not to save. A draft is somewhere to put
   * work in progress — an editor pasting a screenshot mid-sentence should not
   * be stopped, and the 200-odd images imported from Intercom arrived with no
   * alt text at all. The requirement still holds the moment the article is
   * published, which is when a reader could meet the image.
   */
  requireAlt: boolean,
): HelpTranslationInput | null {
  const title = text(t.title, 200);
  if (!title.value) errors[`${prefix}.title`] = "required";
  else if (title.error) errors[`${prefix}.title`] = title.error;

  const slug = typeof t.slug === "string" ? t.slug.trim() : "";
  if (!slug) errors[`${prefix}.slug`] = "required";
  else if (slug.length > 120) errors[`${prefix}.slug`] = "tooLong";
  else if (!SLUG.test(slug)) errors[`${prefix}.slug`] = "invalidSlug";

  const excerpt = text(t.excerpt, 300);
  if (excerpt.error) errors[`${prefix}.excerpt`] = excerpt.error;
  const metaTitle = text(t.meta_title, 70);
  if (metaTitle.error) errors[`${prefix}.meta_title`] = metaTitle.error;
  const metaDescription = text(t.meta_description, 200);
  if (metaDescription.error) errors[`${prefix}.meta_description`] = metaDescription.error;

  if (!isBlockDocument(t.body)) {
    errors[`${prefix}.body`] = "bodyEmpty";
    return null;
  }
  const hasMedia = countNodes(t.body, "figure") + countNodes(t.body, "video") > 0;
  if (!toPlainText(t.body).trim() && !hasMedia) errors[`${prefix}.body`] = "bodyEmpty";
  // Every image needs alt text in this language (brief §8.9): it is what a
  // screen reader says and what image search indexes.
  else if (requireAlt && figureWithoutAlt(t.body)) errors[`${prefix}.body`] = "altMissing";

  // The one extraction field publishing enforces: a retrieval system reads the
  // opening paragraph and little else, so an article without one is invisible
  // however good the rest of it is. Saving a draft is never blocked.
  const answerSummary = text(t.answer_summary, 700);
  if (requireAlt && summaryBlocksPublish(answerSummary.value)) {
    errors[`${prefix}.answer_summary`] = answerSummary.value ? "summaryLength" : "required";
  }
  const questionTitle = text(t.question_title, 200);
  if (questionTitle.error) errors[`${prefix}.question_title`] = questionTitle.error;
  const keyFacts = (Array.isArray(t.key_facts) ? t.key_facts : [])
    .map((fact) => String(fact).trim())
    .filter(Boolean)
    .slice(0, 6);

  if (Object.keys(errors).some((k) => k.startsWith(`${prefix}.`))) return null;
  return {
    slug,
    title: title.value!,
    excerpt: excerpt.value,
    answer_summary: answerSummary.value,
    question_title: questionTitle.value,
    key_facts: keyFacts,
    review_due_at: null,
    body: t.body,
    meta_title: metaTitle.value,
    meta_description: metaDescription.value,
  };
}

export async function saveHelpArticleAction(
  locale: string,
  id: string | null,
  payload: HelpArticlePayload,
): Promise<SaveHelpArticleState> {
  await requireAdmin();
  if (!isLocale(locale)) return { status: "error" };
  if (id !== null && !UUID.test(id)) return { status: "error" };

  const errors: Record<string, HelpFieldError> = {};

  const collections = await getAdminHelpCollections();
  if (!collections.some((c) => c.id === payload.collection_id)) {
    errors.collection_id = "unknownCollection";
  }
  if (!isStatus(payload.status)) return { status: "error" };
  if (!(payload.icon in HELP_ICONS)) errors.icon = "invalidIcon";

  const sectionAr = text(payload.section_ar, 60);
  const sectionEn = text(payload.section_en, 60);
  if (sectionAr.error) errors.section_ar = sectionAr.error;
  if (sectionEn.error) errors.section_en = sectionEn.error;
  if (Boolean(sectionAr.value) !== Boolean(sectionEn.value)) {
    errors[sectionAr.value ? "section_en" : "section_ar"] = "sectionBoth";
  }

  // Arabic is the product default and always required; English may be absent.
  const requireAlt = payload.status === "published";
  const ar = validateTranslation("ar", payload.translations.ar, errors, requireAlt);
  const en = isBlankTranslation(payload.translations.en)
    ? null
    : validateTranslation("en", payload.translations.en!, errors, requireAlt);

  if (Object.keys(errors).length > 0 || !ar) return { status: "invalid", errors };

  const input: HelpArticleInput = {
    collection_id: payload.collection_id,
    status: payload.status,
    is_pinned: Boolean(payload.is_pinned),
    sort_order: Number.isFinite(payload.sort_order) ? Math.trunc(payload.sort_order) : 0,
    section: sectionAr.value && sectionEn.value ? { ar: sectionAr.value, en: sectionEn.value } : null,
    icon: payload.icon,
    translations: { ar, en },
  };

  try {
    const saved = await saveHelpArticle(id, input);
    await refreshChunks(saved.id);
    revalidateHelp(locale);
    // Only a published article is worth telling a search engine about.
    if (payload.status === "published") {
      const collection = collections.find((c) => c.id === payload.collection_id);
      announce(
        articleUrls(
          [ar && { language: "ar" as const, slug: ar.slug }, en && { language: "en" as const, slug: en.slug }].filter(
            (t): t is { language: "ar" | "en"; slug: string } => Boolean(t),
          ),
          collection?.slug ?? null,
        ),
      );
    }
    return { status: "ok", id: saved.id };
  } catch (error) {
    if (error instanceof SlugTaken && error.language !== "collection") {
      return { status: "invalid", errors: { [`${error.language}.slug`]: "slugTaken" } };
    }
    console.error("[flovoo] saving help article failed", error);
    return { status: "error" };
  }
}

/**
 * Brings the article's retrieval chunks in line with its state after a write.
 * Never throws: an article that saved but did not embed is still published,
 * still readable and still findable lexically.
 */
async function refreshChunks(articleId: string): Promise<void> {
  try {
    const found = await getAdminHelpArticle(articleId);
    if (!found) return;
    await syncArticleChunks(
      articleId,
      found.article.status,
      Object.values(found.translations).filter((t) => t !== undefined),
    );
  } catch (error) {
    console.error("[flovoo] refreshing chunks failed", error);
  }
}

export type BulkState =
  | { status: "ok"; count: number }
  | { status: "error" }
  /** Publishing was refused: these articles still carry an undescribed image. */
  | { status: "altMissing"; count: number; titles: string[] };

export async function setHelpArticlesStatusAction(
  locale: string,
  ids: string[],
  status: string,
): Promise<BulkState> {
  await requireAdmin();
  if (!isLocale(locale) || !isStatus(status)) return { status: "error" };
  const valid = ids.filter((id) => UUID.test(id));
  try {
    // The same rule the editor enforces (brief §8.9, and the user's decision
    // that alt text is required to publish). Bulk publishing is publishing —
    // without this check it was a way straight past the guard.
    if (status === "published") {
      const blocked: string[] = [];
      for (const id of valid) {
        const loaded = await getAdminHelpArticle(id);
        if (!loaded) continue;
        const offending = Object.values(loaded.translations).some(
          (t) => t && isBlockDocument(t.body) && figureWithoutAlt(t.body),
        );
        if (offending) {
          const title = loaded.translations.ar?.title ?? loaded.translations.en?.title ?? id;
          blocked.push(title);
        }
      }
      if (blocked.length > 0) {
        return { status: "altMissing", count: blocked.length, titles: blocked.slice(0, 5) };
      }
    }
    await setHelpArticlesStatus(valid, status);
    for (const id of valid) await refreshChunks(id);
    revalidateHelp(locale);
    // Unpublishing matters too: Bing should stop offering a page that is gone.
    const topics = await getAdminHelpCollections();
    const changed: string[] = [];
    for (const id of valid) {
      const loaded = await getAdminHelpArticle(id);
      if (!loaded) continue;
      const collection = topics.find((c) => c.id === loaded.article.collection_id);
      changed.push(
        ...articleUrls(
          (["ar", "en"] as const)
            .map((language) => {
              const translation = loaded.translations[language];
              return translation ? { language, slug: translation.slug } : null;
            })
            .filter((t): t is { language: "ar" | "en"; slug: string } => Boolean(t)),
          collection?.slug ?? null,
        ),
      );
    }
    if (changed.length) announce(changed);
    return { status: "ok", count: valid.length };
  } catch (error) {
    console.error("[flovoo] changing help article status failed", error);
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export type CollectionState =
  | { status: "idle" }
  | { status: "saved"; id: string }
  | { status: "invalid"; errors: Record<string, HelpFieldError> }
  | { status: "error" };

const COLLECTION_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function saveHelpCollectionAction(
  locale: string,
  id: string | null,
  _previous: CollectionState,
  formData: FormData,
): Promise<CollectionState> {
  await requireAdmin();
  if (!isLocale(locale)) return { status: "error" };
  if (id !== null && !UUID.test(id)) return { status: "error" };

  const errors: Record<string, HelpFieldError> = {};
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!slug) errors.slug = "required";
  else if (slug.length > 60) errors.slug = "tooLong";
  else if (!COLLECTION_SLUG.test(slug)) errors.slug = "invalidSlug";

  const nameAr = text(formData.get("name_ar"), 80);
  const nameEn = text(formData.get("name_en"), 80);
  if (!nameAr.value) errors.name_ar = "required";
  else if (nameAr.error) errors.name_ar = nameAr.error;
  if (!nameEn.value) errors.name_en = "required";
  else if (nameEn.error) errors.name_en = nameEn.error;

  const descriptionAr = text(formData.get("description_ar"), 200);
  const descriptionEn = text(formData.get("description_en"), 200);
  if (descriptionAr.error) errors.description_ar = descriptionAr.error;
  if (descriptionEn.error) errors.description_en = descriptionEn.error;

  const icon = String(formData.get("icon") ?? "book-open");
  if (!(icon in HELP_ICONS)) errors.icon = "invalidIcon";

  if (Object.keys(errors).length > 0) return { status: "invalid", errors };

  try {
    const saved = await saveHelpCollection(id, {
      slug,
      name_ar: nameAr.value!,
      name_en: nameEn.value!,
      description_ar: descriptionAr.value,
      description_en: descriptionEn.value,
      icon,
      is_published: formData.get("is_published") === "on",
    });
    revalidateHelp(locale);
    return { status: "saved", id: saved.id };
  } catch (error) {
    if (error instanceof SlugTaken) return { status: "invalid", errors: { slug: "slugTaken" } };
    console.error("[flovoo] saving help collection failed", error);
    return { status: "error" };
  }
}

export type DeleteCollectionState = { status: "ok" } | { status: "notEmpty" } | { status: "error" };

export async function deleteHelpCollectionAction(
  locale: string,
  id: string,
): Promise<DeleteCollectionState> {
  await requireAdmin();
  if (!isLocale(locale) || !UUID.test(id)) return { status: "error" };
  try {
    await deleteHelpCollection(id);
    revalidateHelp(locale);
    return { status: "ok" };
  } catch (error) {
    if (error instanceof CollectionNotEmpty) return { status: "notEmpty" };
    console.error("[flovoo] deleting help collection failed", error);
    return { status: "error" };
  }
}

export async function reorderHelpCollectionsAction(
  locale: string,
  ids: string[],
): Promise<{ status: "ok" | "error" }> {
  await requireAdmin();
  if (!isLocale(locale) || !ids.every((id) => UUID.test(id))) return { status: "error" };
  try {
    await reorderHelpCollections(ids);
    revalidateHelp(locale);
    return { status: "ok" };
  } catch (error) {
    console.error("[flovoo] reordering help collections failed", error);
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export async function updateHelpMediaAltAction(
  locale: string,
  id: string,
  altAr: string,
  altEn: string,
): Promise<{ status: "ok" | "invalid" | "error" }> {
  await requireAdmin();
  if (!isLocale(locale) || !UUID.test(id)) return { status: "error" };
  const ar = text(altAr, 300);
  const en = text(altEn, 300);
  if (ar.error || en.error) return { status: "invalid" };
  try {
    await updateHelpMediaAlt(id, ar.value, en.value);
    revalidateHelp(locale);
    return { status: "ok" };
  } catch (error) {
    console.error("[flovoo] updating media alt failed", error);
    return { status: "error" };
  }
}

export type DeleteMediaState = { status: "ok" } | { status: "inUse" } | { status: "error" };

export async function deleteHelpMediaAction(locale: string, id: string): Promise<DeleteMediaState> {
  await requireAdmin();
  if (!isLocale(locale) || !UUID.test(id)) return { status: "error" };
  try {
    const row = await getAdminHelpMediaById(id);
    if (!row) return { status: "error" };
    // Never orphan an article: a file referenced by a body stays.
    const usage = (await getAdminHelpMedia()).find((m) => m.id === id)?.usageCount ?? 0;
    if (usage > 0) return { status: "inUse" };
    await deleteHelpMedia(row);
    revalidateHelp(locale);
    return { status: "ok" };
  } catch (error) {
    console.error("[flovoo] deleting media failed", error);
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------
// Redirects
// ---------------------------------------------------------------------------

export type RedirectState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "invalid"; errors: Record<string, HelpFieldError> }
  | { status: "error" };

/**
 * Accepts a path or a full URL (an Intercom export lists full URLs) and keeps
 * the path with its query dropped; only same-site paths are ever stored.
 */
function normalisePath(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  let path = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      path = new URL(value).pathname;
    } catch {
      return null;
    }
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 500) return null;
  try {
    path = decodeURIComponent(path);
  } catch {
    // keep as typed
  }
  return path.replace(/\/+$/, "") || "/";
}

function validateRedirect(
  source: string,
  target: string,
): { input: HelpRedirectInput } | { errors: Record<string, HelpFieldError> } {
  const errors: Record<string, HelpFieldError> = {};
  const sourcePath = normalisePath(source);
  const targetPath = /^https?:\/\//i.test(target.trim()) ? target.trim() : normalisePath(target);
  if (!sourcePath) errors.source_path = source.trim() ? "invalidPath" : "required";
  if (!targetPath) errors.target_path = target.trim() ? "invalidPath" : "required";
  if (sourcePath && targetPath && sourcePath === targetPath) errors.target_path = "samePath";
  if (Object.keys(errors).length > 0) return { errors };
  return { input: { source_path: sourcePath!, target_path: targetPath! } };
}

export async function saveHelpRedirectAction(
  locale: string,
  _previous: RedirectState,
  formData: FormData,
): Promise<RedirectState> {
  await requireAdmin();
  if (!isLocale(locale)) return { status: "error" };
  const checked = validateRedirect(
    String(formData.get("source_path") ?? ""),
    String(formData.get("target_path") ?? ""),
  );
  if ("errors" in checked) return { status: "invalid", errors: checked.errors };
  try {
    await upsertHelpRedirects([checked.input]);
    revalidateHelp(locale);
    return { status: "saved" };
  } catch (error) {
    console.error("[flovoo] saving redirect failed", error);
    return { status: "error" };
  }
}

export type ImportRedirectsState =
  | { status: "idle" }
  | { status: "done"; imported: number; skipped: number }
  | { status: "error" };

/**
 * Bulk import: one redirect per line, `source,target` (or tab / semicolon
 * separated), full URLs allowed, a header line ignored. Bad lines are
 * skipped and counted rather than failing the whole import.
 */
export async function importHelpRedirectsAction(
  locale: string,
  _previous: ImportRedirectsState,
  formData: FormData,
): Promise<ImportRedirectsState> {
  await requireAdmin();
  if (!isLocale(locale)) return { status: "error" };

  const lines = String(formData.get("csv") ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const inputs: HelpRedirectInput[] = [];
  let skipped = 0;
  for (const line of lines) {
    const [source = "", target = ""] = line.split(/[,;\t]/).map((cell) => cell.trim().replace(/^"|"$/g, ""));
    if (/^(source|from|old)/i.test(source)) continue; // header
    const checked = validateRedirect(source, target);
    if ("errors" in checked) skipped += 1;
    else inputs.push(checked.input);
  }

  try {
    const imported = await upsertHelpRedirects(inputs);
    revalidateHelp(locale);
    return { status: "done", imported, skipped };
  } catch (error) {
    console.error("[flovoo] importing redirects failed", error);
    return { status: "error" };
  }
}

export async function deleteHelpRedirectAction(
  locale: string,
  id: string,
): Promise<{ status: "ok" | "error" }> {
  await requireAdmin();
  if (!isLocale(locale) || !UUID.test(id)) return { status: "error" };
  try {
    await deleteHelpRedirect(id);
    revalidateHelp(locale);
    return { status: "ok" };
  } catch (error) {
    console.error("[flovoo] deleting redirect failed", error);
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------
// Content-gap inbox
// ---------------------------------------------------------------------------

/** "Not a gap": hides a zero-result question or a piece of feedback for good. */
export async function dismissContentGapAction(
  locale: string,
  kind: string,
  ref: string,
): Promise<{ status: "ok" | "error" }> {
  await requireAdmin();
  if (!isLocale(locale)) return { status: "error" };
  if (kind !== "query" && kind !== "feedback") return { status: "error" };
  if (!ref.trim() || ref.length > 400) return { status: "error" };
  try {
    await dismissContentGap(kind, ref.trim());
    revalidatePath(`/${locale}/admin/help/analytics`);
    return { status: "ok" };
  } catch (error) {
    console.error("[flovoo] dismissing content gap failed", error);
    return { status: "error" };
  }
}
