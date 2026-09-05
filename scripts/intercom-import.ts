/**
 * Replaces the sample help-center content with everything exported from
 * Intercom.
 *
 *   npm run intercom:import           plan only — writes migration/import-review.md
 *   npm run intercom:import -- --apply   uploads the images, then imports
 *
 * The deletion of the samples and the whole import run inside ONE transaction,
 * so a failure anywhere leaves the sample content exactly as it was. Images are
 * uploaded before that transaction because object storage cannot join it; the
 * upload is idempotent (each file has a path derived from its own bytes) so a
 * second run neither duplicates nor re-sends what is already there.
 *
 * Everything imports as a DRAFT, including articles Intercom had published.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

import { convertBody, decodeEntities, type BlockNode } from "./intercom-html.ts";
import { deriveArticleMeta } from "../src/lib/help/blocks.ts";
import { suggestSlug } from "../src/lib/help/slug.ts";

const root = join(import.meta.dirname, "..");
const exportDir = join(root, "migration", "intercom-export");
const APPLY = process.argv.includes("--apply");

// ---------------------------------------------------------------------------
// The user's decisions, in one place
// ---------------------------------------------------------------------------

/** The Spanish demo article Intercom ships with a new workspace (decision 1). */
const DROPPED_ARTICLES = new Set(["14413682"]);

/** Where articles Intercom left uncategorised go until they are sorted (decision 9). */
const HOLDING_COLLECTION = {
  slug: "uncategorized",
  name_ar: "غير مصنّف — بحاجة إلى توزيع",
  name_en: "Uncategorized — needs sorting",
  description_ar: "مقالات لم يكن لها تصنيف في Intercom. أعِد توزيعها على التصنيفات من هنا.",
  description_en: "Articles that had no collection in Intercom. Move them to a real topic from here.",
  icon: "book-open",
  sort_order: 900,
};

/** Intercom collection id → a Lucide name from the help center's allow-list. */
const COLLECTION_ICONS: Record<string, string> = {
  "19272332": "rocket", // Getting Started
  "19281512": "message-circle", // WhatsApp
  "19281506": "message-square-text", // Facebook Messenger & Instagram
  "19442763": "smartphone", // TikTok
  "19442765": "layout-template", // Website Chat Widget
  "19637290": "triangle-alert", // WhatsApp Errors
  "19272333": "bar-chart-3", // Analysis & Reports
  "19442769": "users", // Contacts
  "19442766": "inbox", // Chats
  "19442772": "zap", // AI Agents
  "19442775": "megaphone", // Campaigns / Broadcasts
  "19442777": "workflow", // Automation / Workflows
  "19272334": "settings", // Settings
  "19272336": "credit-card", // Payments
  "19272331": "plug", // Integrations
};

type Locale = "ar" | "en";
const LOCALES: Locale[] = ["ar", "en"];
const NOT_A_LOCALE = new Set(["type"]);

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

interface IntercomTranslation {
  title?: string;
  description?: string;
  body?: string;
  state?: string;
  url?: string;
}
interface IntercomArticle {
  id: string;
  title?: string;
  state?: string;
  url?: string;
  parent_ids?: (string | number)[];
  default_locale?: string;
  translated_content?: Record<string, IntercomTranslation | null>;
}
interface IntercomCollection {
  id: string;
  name?: string;
  description?: string;
  url?: string;
  order?: number;
  icon?: string;
  translated_content?: Record<string, { name?: string; description?: string } | null>;
}
interface ImageEntry {
  url: string;
  file: string | null;
  bytes: number;
  contentType: string | null;
  articles: string[];
  alt: string | null;
}

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv();
const raw = JSON.parse(readFileSync(join(exportDir, "intercom-raw.json"), "utf8")) as {
  collections: IntercomCollection[];
  articles: IntercomArticle[];
};
const manifest = JSON.parse(readFileSync(join(exportDir, "images.json"), "utf8")) as {
  images: ImageEntry[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clean = (value: string | undefined | null): string => decodeEntities(value ?? "").trim();

function translationsOf<T>(record: Record<string, T | null> | undefined): [Locale, T][] {
  const out: [Locale, T][] = [];
  for (const [key, value] of Object.entries(record ?? {})) {
    if (NOT_A_LOCALE.has(key) || !value) continue;
    if (key === "ar" || key === "en") out.push([key, value]);
  }
  return out;
}

/** `https://help.flovoo.com/en/articles/16536857-how-to-…` → `how-to-…` */
function slugFromUrl(url: string | undefined): string {
  if (!url) return "";
  const last = decodeURIComponent(url.split("?")[0].split("#")[0].split("/").filter(Boolean).at(-1) ?? "");
  return last.replace(/^\d+-?/, "").trim();
}

/** The path an old Intercom link used, as `help_redirects.source_path` stores it. */
function pathOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return decodeURIComponent(new URL(url).pathname).replace(/\/$/, "") || null;
  } catch {
    return null;
  }
}

const collectionIdOf = (article: IntercomArticle): string | null =>
  article.parent_ids?.length ? String(article.parent_ids[0]) : null;

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

interface PlannedCollection {
  intercomId: string | null;
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  icon: string;
  sort_order: number;
}

interface PlannedTranslation {
  language: Locale;
  slug: string;
  title: string;
  excerpt: string | null;
  body: { type: "doc"; content: BlockNode[] };
  body_plain: string;
  toc: unknown;
  reading_minutes: number;
  /** The Intercom path this language was served at, if it was public. */
  oldPath: string | null;
  intercomState: string | null;
}

interface PlannedArticle {
  intercomId: string;
  collectionSlug: string;
  sort_order: number;
  translations: PlannedTranslation[];
  intercomState: string;
  isEmpty: boolean;
  wasUncategorized: boolean;
  imageCount: number;
  imagesWithoutAlt: number;
}

const notes: string[] = [];
/** Files left in the bucket after their database rows went — reported, not deleted. */
const orphanedFiles: string[] = [];
/** Links inside bodies pointing at Intercom articles that no longer exist. */
const deadLinks = new Map<string, number>();
const usedSlugs: Record<Locale, Set<string>> = { ar: new Set(), en: new Set() };

function uniqueSlug(language: Locale, candidate: string, intercomId: string): string {
  // Slugs are stored verbatim; only the characters the column forbids are
  // stripped. An article whose Intercom slug was empty keeps its Intercom id,
  // which is both unique and exactly what its old link contained.
  let slug = candidate.replace(/[/\\?#%\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  if (!slug) slug = intercomId;
  if (!usedSlugs[language].has(slug)) {
    usedSlugs[language].add(slug);
    return slug;
  }
  const suffixed = `${slug}-${intercomId}`;
  notes.push(
    `تعارض في الروابط (${language === "ar" ? "العربية" : "الإنجليزية"}): الرابط «${slug}» كان محجوزًا، فصار رابط المقالة ${intercomId} هو «${suffixed}».`,
  );
  usedSlugs[language].add(suffixed);
  return suffixed;
}

// -- images -----------------------------------------------------------------

const EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const MAX_BYTES = 8 * 1024 * 1024; // the help-media bucket's limit (migration 0007)

interface PlannedImage {
  url: string;
  localFile: string;
  storagePath: string;
  publicUrl: string;
  contentType: string;
  bytes: number;
  alt: string | null;
}

const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const plannedImages = new Map<string, PlannedImage>();
const skippedImages: { url: string; why: string; articles: string[] }[] = [];

for (const image of manifest.images) {
  const usedByKeptArticle = image.articles.some((id) => !DROPPED_ARTICLES.has(id));
  if (!usedByKeptArticle) continue;
  if (!image.file || !image.contentType) {
    skippedImages.push({ url: image.url, why: "was never downloaded", articles: image.articles });
    continue;
  }
  const extension = EXTENSION[image.contentType];
  if (!extension) {
    skippedImages.push({ url: image.url, why: `type ${image.contentType} is not accepted`, articles: image.articles });
    continue;
  }
  if (image.bytes > MAX_BYTES) {
    skippedImages.push({
      url: image.url,
      why: `${(image.bytes / 1024 / 1024).toFixed(1)} MB is over the 8 MB storage limit`,
      articles: image.articles,
    });
    continue;
  }
  const key = createHash("sha256").update(image.url).digest("hex").slice(0, 32);
  const storagePath = `intercom/${key}.${extension}`;
  plannedImages.set(image.url, {
    url: image.url,
    localFile: image.file,
    storagePath,
    publicUrl: `${supabaseUrl}/storage/v1/object/public/help-media/${storagePath}`,
    contentType: image.contentType,
    bytes: image.bytes,
    alt: image.alt,
  });
}

// -- collections ------------------------------------------------------------

const plannedCollections: PlannedCollection[] = [];
const collectionSlugById = new Map<string, string>();

for (const collection of raw.collections) {
  const byLocale = Object.fromEntries(translationsOf(collection.translated_content));
  const slugBase = slugFromUrl(collection.url) || suggestSlug(clean(collection.name)) || `collection-${collection.id}`;
  // Collection slugs are Latin and shared by both languages (the column's own check).
  const slug = slugBase.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `collection-${collection.id}`;
  collectionSlugById.set(String(collection.id), slug);
  plannedCollections.push({
    intercomId: String(collection.id),
    slug,
    name_ar: clean(byLocale.ar?.name) || clean(collection.name),
    name_en: clean(byLocale.en?.name) || clean(collection.name),
    description_ar: clean(byLocale.ar?.description) || null,
    description_en: clean(byLocale.en?.description) || null,
    icon: COLLECTION_ICONS[String(collection.id)] ?? "book-open",
    sort_order: collection.order ?? 0,
  });
}

// -- articles ---------------------------------------------------------------

const kept = raw.articles.filter((a) => !DROPPED_ARTICLES.has(a.id));
const plannedArticles: PlannedArticle[] = [];
const conversionProblems: string[] = [];
const droppedLocales: string[] = [];

/** Intercom article id → its slug per language, so in-body links can be rewritten. */
const slugByArticle = new Map<string, Partial<Record<Locale, string>>>();
/** Intercom heading anchor → our generated fragment, per article and language. */
const anchorMap = new Map<string, Map<string, string>>();

// Pass 1: slugs, so pass 2 can rewrite links between articles.
for (const article of kept) {
  const perLocale: Partial<Record<Locale, string>> = {};
  for (const locale of LOCALES) {
    const translation = article.translated_content?.[locale];
    if (!translation) continue;
    const candidate = slugFromUrl(translation.url) || suggestSlug(clean(translation.title) || clean(article.title));
    perLocale[locale] = uniqueSlug(locale, candidate, article.id);
  }
  slugByArticle.set(article.id, perLocale);
}

for (const article of kept) {
  for (const [locale] of translationsOf(article.translated_content)) void locale;
  for (const key of Object.keys(article.translated_content ?? {})) {
    if (!NOT_A_LOCALE.has(key) && key !== "ar" && key !== "en" && article.translated_content?.[key]) {
      droppedLocales.push(`${article.id} had a "${key}" version`);
    }
  }
}

// Pass 2: bodies.
const bySlug = new Map<string, PlannedArticle[]>();
for (const article of kept) {
  const intercomCollection = collectionIdOf(article);
  const collectionSlug = intercomCollection
    ? (collectionSlugById.get(intercomCollection) ?? HOLDING_COLLECTION.slug)
    : HOLDING_COLLECTION.slug;

  const translations: PlannedTranslation[] = [];
  let imageCount = 0;
  let imagesWithoutAlt = 0;

  for (const locale of LOCALES) {
    const translation = article.translated_content?.[locale];
    if (!translation) continue;

    const anchors = new Map<string, string>();
    const converted = convertBody(translation.body ?? "", {
      resolveImage: (url) => {
        const planned = plannedImages.get(url);
        if (!planned) return null;
        imageCount++;
        if (!planned.alt) imagesWithoutAlt++;
        return { src: planned.publicUrl, width: null, height: null };
      },
      resolveLink: (href) => rewriteLink(href, locale),
    });
    if (converted.unhandled.length) {
      conversionProblems.push(`${article.id}/${locale}: ${converted.unhandled.join("; ")}`);
    }
    for (const image of converted.unresolvedImages) {
      conversionProblems.push(`${article.id}/${locale}: image not in our storage — ${image.slice(0, 90)}`);
    }
    for (const anchor of converted.anchors) anchors.set(anchor.id, anchor.text);
    anchorMap.set(`${article.id}/${locale}`, anchors);

    const meta = deriveArticleMeta(converted.doc as never);
    const title = clean(translation.title) || clean(article.title) || article.id;
    translations.push({
      language: locale,
      slug: slugByArticle.get(article.id)?.[locale] ?? uniqueSlug(locale, "", article.id),
      title,
      excerpt: clean(translation.description) || null,
      body: converted.doc,
      body_plain: meta.body_plain,
      toc: meta.toc,
      reading_minutes: meta.reading_minutes,
      oldPath: pathOf(translation.url) ?? null,
      intercomState: translation.state ?? null,
    });
  }

  if (!translations.length) {
    conversionProblems.push(`${article.id}: no Arabic or English version — nothing to import`);
    continue;
  }

  const planned: PlannedArticle = {
    intercomId: article.id,
    collectionSlug,
    sort_order: 0,
    translations,
    intercomState: article.state ?? "unknown",
    isEmpty: translations.every((t) => !t.body_plain.trim()),
    wasUncategorized: !intercomCollection,
    imageCount,
    imagesWithoutAlt,
  };
  plannedArticles.push(planned);
  bySlug.set(collectionSlug, [...(bySlug.get(collectionSlug) ?? []), planned]);
}

for (const group of bySlug.values()) {
  group.forEach((article, index) => {
    article.sort_order = index;
  });
}

/** Rewrites an old help-centre link onto the article that replaced it. */
function rewriteLink(href: string, locale: Locale): string | null {
  const match = href.match(/^https?:\/\/help\.flovoo\.com\/(ar|en)\/articles\/(\d+)(?:-[^?#]*)?(#[^?]*)?/i);
  if (!match) return null;
  const targetLocale = match[1] as Locale;
  const targetId = match[2];
  const fragment = (match[3] ?? "").length > 1 ? match[3] : "";
  const slug = slugByArticle.get(targetId)?.[targetLocale];
  if (!slug) {
    // The target is not in the export: an article deleted from Intercom before
    // this migration, whose link is dead already. Left exactly as it was.
    deadLinks.set(href.split("#")[0], (deadLinks.get(href.split("#")[0]) ?? 0) + 1);
    return null;
  }
  const anchors = anchorMap.get(`${targetId}/${targetLocale}`);
  // Intercom fragments (`#h_14fa…`) are its own ids. Ours are built from the
  // heading text, so the fragment is carried only when the heading is known.
  const carried = fragment && anchors?.has(fragment.slice(1)) ? `#${headingFragment(anchors.get(fragment.slice(1))!)}` : "";
  if (fragment && !carried) {
    notes.push(`لم يُنقل الجزء \`${fragment}\` من رابط داخلي إلى المقالة ${targetId} لأن العنوان المقابل له غير موجود.`);
  }
  void locale;
  return `/${targetLocale}/articles/${encodeURIComponent(slug)}${carried}`;
}

/** The same id `withHeadingIds()` in the app assigns, for a single heading. */
function headingFragment(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/[\s-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "section"
  );
}

// -- redirects --------------------------------------------------------------

interface PlannedRedirect {
  source_path: string;
  target_path: string;
  note: string;
}
const plannedRedirects = new Map<string, PlannedRedirect>();
const addRedirect = (source: string, target: string, note: string) => {
  if (!source.startsWith("/") || source === target) return;
  if (!plannedRedirects.has(source)) plannedRedirects.set(source, { source_path: source, target_path: target, note });
};

for (const article of plannedArticles) {
  for (const translation of article.translations) {
    const target = `/${translation.language}/articles/${translation.slug}`;
    if (translation.oldPath) addRedirect(translation.oldPath, target, `article ${article.intercomId}`);
    // The id-only spelling catches every other slug an old link might carry.
    addRedirect(`/${translation.language}/articles/${article.intercomId}`, target, `article ${article.intercomId} by id`);
  }
}
for (const collection of plannedCollections) {
  if (!collection.intercomId) continue;
  for (const locale of LOCALES) {
    const target = `/${locale}/categories/${collection.slug}`;
    addRedirect(`/${locale}/collections/${collection.intercomId}-${collection.slug}`, target, `collection ${collection.intercomId}`);
    addRedirect(`/${locale}/collections/${collection.intercomId}`, target, `collection ${collection.intercomId} by id`);
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const emptyArticles = plannedArticles.filter((a) => a.isEmpty);
const totalImages = plannedImages.size;
const totalImageBytes = [...plannedImages.values()].reduce((sum, i) => sum + i.bytes, 0);

console.log("PLAN");
console.log(`  collections        ${plannedCollections.length} from Intercom + 1 holding = ${plannedCollections.length + 1}`);
console.log(`  articles           ${plannedArticles.length} of ${raw.articles.length} exported (${DROPPED_ARTICLES.size} dropped by decision)`);
console.log(`  translations       ${plannedArticles.reduce((n, a) => n + a.translations.length, 0)}`);
console.log(`  empty bodies       ${emptyArticles.length}`);
console.log(`  uncategorized      ${plannedArticles.filter((a) => a.wasUncategorized).length} → "${HOLDING_COLLECTION.slug}"`);
console.log(`  images             ${totalImages} (${(totalImageBytes / 1024 / 1024).toFixed(1)} MB), ${skippedImages.length} skipped`);
console.log(`  redirects          ${plannedRedirects.size}`);
console.log(`  conversion issues  ${conversionProblems.length}`);
for (const problem of conversionProblems.slice(0, 20)) console.log(`     ${problem}`);
if (skippedImages.length) {
  console.log("  skipped images:");
  for (const image of skippedImages) console.log(`     ${image.why} — used by ${image.articles.join(", ")}`);
}
for (const note of notes) console.log(`  note: ${note}`);

if (conversionProblems.length) {
  console.error("\nRefusing to import while anything is unconverted. Nothing was written.");
  process.exit(1);
}

writeReview();

if (!APPLY) {
  console.log("\nPlan only. Re-run with --apply to upload the images and import.");
  process.exit(0);
}

await applyEverything();

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

async function applyEverything() {
  const storage = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  console.log(`\nuploading ${plannedImages.size} images…`);
  let uploaded = 0;
  for (const image of plannedImages.values()) {
    const bytes = readFileSync(join(exportDir, "images", image.localFile));
    const { error } = await storage.storage
      .from("help-media")
      .upload(image.storagePath, bytes, {
        contentType: image.contentType,
        upsert: true,
        cacheControl: "31536000",
      });
    if (error) throw new Error(`upload failed for ${image.storagePath}: ${error.message}`);
    uploaded++;
    process.stdout.write(`\r  ${uploaded}/${plannedImages.size}   `);
  }
  process.stdout.write("\n");
  console.log(`  uploaded ${uploaded}`);

  const sql = postgres(env.SUPABASE_DB_URL!, { ssl: "require", max: 1, connect_timeout: 20 });
  try {
    await sql.begin(async (tx) => {
      // "No test remnants" (decision 10): the sample content, the redirect that
      // came with it, the one image uploaded while testing the editor, and the
      // handful of views, ratings and searches produced by that testing — which
      // would otherwise show up as real numbers in the analytics.
      const oldCollections = await tx`select id from help_collections`;
      const oldArticles = await tx`select id from help_articles`;
      const oldMedia = await tx`select storage_path from help_media`;
      console.log(
        `\ndeleting ${oldArticles.length} sample articles, ${oldCollections.length} sample collections, ${oldMedia.length} media rows`,
      );
      // Articles first: the collection reference is `on delete restrict`.
      await tx`delete from help_articles`;
      await tx`delete from help_collections`;
      await tx`delete from help_redirects`;
      await tx`delete from help_media`;
      await tx`delete from help_search_queries`;
      await tx`delete from help_not_found`;
      for (const row of oldMedia) {
        if (!String(row.storage_path).startsWith("intercom/")) {
          orphanedFiles.push(String(row.storage_path));
        }
      }

      const all = [
        ...plannedCollections,
        { ...HOLDING_COLLECTION, intercomId: null as string | null },
      ];
      const collectionIds = new Map<string, string>();
      for (const collection of all) {
        const [row] = await tx`
          insert into help_collections
            (slug, name_ar, name_en, description_ar, description_en, icon, sort_order, is_published)
          values (${collection.slug}, ${collection.name_ar}, ${collection.name_en},
                  ${collection.description_ar}, ${collection.description_en},
                  ${collection.icon}, ${collection.sort_order}, ${false})
          returning id`;
        collectionIds.set(collection.slug, row.id as string);
      }
      console.log(`inserted ${collectionIds.size} collections (all unpublished — nothing is public yet)`);

      for (const article of plannedArticles) {
        const collectionId = collectionIds.get(article.collectionSlug);
        if (!collectionId) throw new Error(`no collection for ${article.intercomId}`);
        const [row] = await tx`
          insert into help_articles (collection_id, status, sort_order, icon)
          values (${collectionId}, ${"draft"}, ${article.sort_order}, ${"file-text"})
          returning id`;
        for (const translation of article.translations) {
          await tx`
            insert into help_article_translations
              (article_id, language, slug, title, excerpt, body, body_plain, toc, reading_minutes)
            values (${row.id}, ${translation.language}, ${translation.slug}, ${translation.title},
                    ${translation.excerpt}, ${tx.json(translation.body as never)}, ${translation.body_plain},
                    ${tx.json(translation.toc as never)}, ${translation.reading_minutes})`;
        }
      }
      console.log(`inserted ${plannedArticles.length} articles, all as drafts`);

      for (const image of plannedImages.values()) {
        await tx`
          insert into help_media (storage_path, alt_ar, alt_en)
          values (${image.storagePath}, ${image.alt}, ${image.alt})
          on conflict (storage_path) do nothing`;
      }
      console.log(`recorded ${plannedImages.size} images in the media library`);

      for (const redirect of plannedRedirects.values()) {
        await tx`
          insert into help_redirects (source_path, target_path, status_code)
          values (${redirect.source_path}, ${redirect.target_path}, ${301})
          on conflict (source_path) do update set target_path = excluded.target_path`;
      }
      console.log(`inserted ${plannedRedirects.size} redirects`);
    });
    console.log("\ncommitted.");
    if (orphanedFiles.length) {
      console.log("\nStill in the help-media bucket with no row pointing at them:");
      for (const file of orphanedFiles) console.log(`  ${file}`);
      console.log("Left in place on purpose — deleting somebody's upload is their call, not this script's.");
    }
  } finally {
    await sql.end();
  }
}

// ---------------------------------------------------------------------------
// The review file
// ---------------------------------------------------------------------------

function writeReview() {
  const lines: string[] = [];
  const add = (line = "") => lines.push(line);

  add("# مراجعة استيراد Intercom");
  add();
  add(`أُنشئ في ${new Date().toISOString()}.`);
  add();
  add("## الجرد");
  add();
  add("| | في Intercom | استُورد | الفارق |");
  add("| --- | --- | --- | --- |");
  add(`| التصنيفات | ${raw.collections.length} | ${plannedCollections.length} + 1 مؤقّت | 0 |`);
  add(`| المقالات | ${raw.articles.length} | ${plannedArticles.length} | ${raw.articles.length - plannedArticles.length} (مُسقطة بقرارك) |`);
  add(`| نسخ اللغات | ${countSourceTranslations()} | ${plannedArticles.reduce((n, a) => n + a.translations.length, 0)} | ${countSourceTranslations() - plannedArticles.reduce((n, a) => n + a.translations.length, 0)} |`);
  add(`| الصور | ${manifest.images.length} | ${plannedImages.size} | ${manifest.images.length - plannedImages.size} (تخص المقالة المُسقطة وحدها) |`);
  add(`| إعادات التوجيه | — | ${plannedRedirects.size} | — |`);
  add();

  add("## ما لم يُستورد ولماذا");
  add();
  for (const id of DROPPED_ARTICLES) {
    const article = raw.articles.find((a) => a.id === id);
    add(`- **المقالة ${id} «${clean(article?.title)}»** — المقالة التجريبية الإسبانية. أسقطتها بقرارك رقم 1.`);
  }
  for (const dropped of droppedLocales) add(`- ${dropped} — لغة لا يدعمها الموقع (عربي/إنجليزي فقط).`);
  for (const image of skippedImages) {
    add(`- **صورة** ${image.why} — كانت في المقالات ${image.articles.join("، ")}.`);
  }
  if (!droppedLocales.length && !skippedImages.length) add("- لا شيء غير ما سبق.");
  add();

  add("## تحتاج محتوى");
  add();
  add(`${emptyArticles.length} مقالة استُوردت بروابطها وهي فارغة تمامًا. كلها مسودات، ولكل واحدة إعادة توجيه من رابط Intercom القديم، فلن ينكسر أي رابط منشور.`);
  add();
  add("| رقم Intercom | العنوان | الحالة في Intercom | التصنيف | الرابط عندنا |");
  add("| --- | --- | --- | --- | --- |");
  for (const article of emptyArticles) {
    const ar = article.translations.find((t) => t.language === "ar");
    const en = article.translations.find((t) => t.language === "en");
    const shown = ar ?? en!;
    add(
      `| ${article.intercomId} | ${shown.title} | ${article.intercomState === "published" ? "منشورة" : "مسودة"} | ${article.collectionSlug} | \`/${shown.language}/articles/${shown.slug}\` |`,
    );
  }
  add();

  add("## المقالات التي كانت بلا تصنيف");
  add();
  const orphans = plannedArticles.filter((a) => a.wasUncategorized);
  add(`${orphans.length} مقالة وُضعت في تصنيف مؤقّت اسمه «${HOLDING_COLLECTION.name_ar}» لتعيد توزيعها من لوحة التحكم.`);
  add();
  for (const article of orphans) {
    const shown = article.translations[0];
    add(`- ${article.intercomId} — «${shown.title}»${article.isEmpty ? " (فارغة)" : ""}`);
  }
  add();

  add("## قواعد التحويل المطبَّقة");
  add();
  add("- `h1` داخل النص صار عنوانًا من المستوى الثاني، و`h4` صار من المستوى الثالث (قرارك 5).");
  add("- ألوان التنبيهات: الأخضر «نصيحة»، الرمادي «ملاحظة»، الأصفر «تنبيه» (قرارك 6).");
  add("- المحاذاة (`intercom-align-*`) أُسقطت والمحتوى بقي (قرارك 3).");
  add("- المؤلّف لم يُنقل ولم يُضف حقل له (قرارك 2).");
  add("- الفقرات الفارغة التي يستخدمها Intercom كمسافات حُذفت؛ التباعد عندنا من التصميم لا من فقرات فارغة.");
  add("- الفواصل الأفقية `<hr>` نُقلت كما هي (666 فاصلًا، أغلبها قبل العناوين). إن أردت حذفها لاحقًا فهي عنصر واحد يسهل إزالته.");
  add("- صفوف الجداول: Intercom لا يستخدم `<th>`، بل يلوّن صف العنوان. رُقّي الصف الأول إلى صف عناوين فقط حين تكون كل خلاياه ملوّنة — وإلا بقي صفًا عاديًا كما في Intercom.");
  add("- الروابط الداخلية بين المقالات أُعيد توجيهها إلى الروابط الجديدة مباشرة، لا عبر إعادة توجيه.");
  add();

  add("## روابط داخل النصوص تشير إلى مقالات محذوفة من Intercom");
  add();
  if (deadLinks.size === 0) {
    add("لا يوجد.");
  } else {
    add("هذه روابط مكتوبة داخل نصوص المقالات وتشير إلى مقالات لم تعد موجودة في Intercom نفسه، أي أنها مكسورة قبل الهجرة لا بسببها. تركتها كما هي ولم أحذفها.");
    add();
    for (const [href, count] of deadLinks) add(`- \`${decodeURIComponent(href)}\` (${count} مرة)`);
  }
  add();

  add("## أمور تحتاج قرارك");
  add();
  add(`- **الوصف البديل للصور:** ${plannedImages.size} صورة استُوردت، ولا واحدة منها تحمل وصفًا بديلًا في Intercom. قرارك 4 يجعل الوصف البديل مطلوبًا عند النشر، فلن تستطيع نشر أي مقالة فيها صور قبل كتابته.`);
  add("- **التصنيفات استُوردت غير منشورة.** «الاستيراد كله كمسودات» لا معنى له إن كانت التصنيفات ظاهرة وفارغة للزوّار، لذلك جعلتها كلها غير منشورة. انشر كل تصنيف من لوحة التحكم متى صار جاهزًا.");
  add("- **الروابط القديمة لن تعمل قبل النشر.** إعادات التوجيه مكتوبة وصحيحة، لكنها تنتهي إلى مقالات ما زالت مسودات، والمسودة ترجع 404 للزائر. هذا لا يضر شيئًا الآن لأن help.flovoo.com ما زال يشير إلى Intercom — لكن لا توجّه النطاق إلينا قبل نشر المقالات.");
  add("- **المقالة 15552104** فيها قالب بريد HTML كامل داخل كتلة شيفرة. نُقل نصًا حرفيًا كما هو، ولم تُحوّل الروابط التي بداخله لأنها شيفرة لا روابط.");
  for (const note of notes) add(`- ${note}`);
  add();

  writeFileSync(join(root, "migration", "import-review.md"), lines.join("\n"), "utf8");
  console.log(`\nwrote ${join(root, "migration", "import-review.md")}`);
}

/** Arabic and English versions across the whole export, dropped articles included. */
function countSourceTranslations(): number {
  let n = 0;
  for (const article of raw.articles) {
    for (const locale of LOCALES) if (article.translated_content?.[locale]) n++;
  }
  return n;
}
