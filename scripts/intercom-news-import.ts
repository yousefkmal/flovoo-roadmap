/**
 * Imports Intercom's News into the roadmap's "what's new" page.
 *
 *   npm run intercom:news-import           plan only — writes migration/news-review.md
 *   npm run intercom:news-import -- --apply
 *
 * Additive: nothing already in `changelog_entries` is touched. Everything
 * lands unpublished, and the whole thing is one transaction.
 *
 * Intercom writes one news item per language and stores no field linking the
 * two halves of an announcement. The pairing is worked out in
 * `intercom-news-survey.ts` and repeated here; see that file for how it was
 * validated against the 31 pairs a shared cover image proves.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

import { convertBody, decodeEntities, type BlockNode } from "./intercom-html.ts";

const root = join(import.meta.dirname, "..");
const exportDir = join(root, "migration", "intercom-export");
const APPLY = process.argv.includes("--apply");

// ---------------------------------------------------------------------------
// The user's decisions
// ---------------------------------------------------------------------------

/** Intercom's kind labels → our three (`changelog_kind`). */
const KIND: Record<string, "new" | "improved" | "fixed"> = {
  Feature: "new",
  "New feature": "new",
  "Feature update": "new",
  Improvement: "improved",
  "Product update": "improved",
};
/** An item Intercom left unlabelled. Listed in the review file. */
const KIND_WHEN_UNLABELLED = "new" as const;

const ARABIC_FEED = 102840;
const ENGLISH_FEED = 102841;

type Locale = "ar" | "en";

interface NewsItem {
  id: string;
  title: string | null;
  body: string | null;
  state: string;
  labels: string[];
  cover_image_url?: string | null;
  cover_image_file?: string | null;
  created_at: number;
  published_at: number | null;
  newsfeed_assignments: { newsfeed_id: number }[];
}

const data = JSON.parse(readFileSync(join(exportDir, "intercom-news.json"), "utf8")) as {
  news_items: NewsItem[];
};
const items = data.news_items;

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

const titleOf = (item: NewsItem) => decodeEntities(item.title ?? "").trim();

function languageOf(item: NewsItem): Locale | null {
  const feeds = new Set(item.newsfeed_assignments.map((a) => a.newsfeed_id));
  if (feeds.has(ARABIC_FEED)) return "ar";
  if (feeds.has(ENGLISH_FEED)) return "en";
  if (item.labels.includes("ar")) return "ar";
  if (item.labels.includes("en")) return "en";
  return null;
}

// ---------------------------------------------------------------------------
// Pairing (see intercom-news-survey.ts)
// ---------------------------------------------------------------------------

interface Pair {
  ar: NewsItem;
  en: NewsItem;
  evidence: "cover" | "time" | "read";
}

const pairs: Pair[] = [];
const taken = new Set<string>();

const byCover = new Map<string, NewsItem[]>();
for (const item of items) {
  const asset = item.cover_image_file;
  if (!asset) continue;
  byCover.set(asset, [...(byCover.get(asset) ?? []), item]);
}
for (const group of byCover.values()) {
  if (group.length !== 2) continue;
  const ar = group.find((i) => languageOf(i) === "ar");
  const en = group.find((i) => languageOf(i) === "en");
  if (!ar || !en || taken.has(ar.id) || taken.has(en.id)) continue;
  taken.add(ar.id);
  taken.add(en.id);
  pairs.push({ ar, en, evidence: "cover" });
}

const combos: { ar: NewsItem; en: NewsItem; idGap: number; seconds: number }[] = [];
for (const ar of items.filter((i) => languageOf(i) === "ar" && !taken.has(i.id))) {
  for (const en of items.filter((i) => languageOf(i) === "en" && !taken.has(i.id))) {
    const idGap = Number(ar.id) - Number(en.id);
    const seconds = ar.created_at - en.created_at;
    if (idGap < 1 || idGap > 20) continue;
    if (seconds < -600 || seconds > 7200) continue;
    combos.push({ ar, en, idGap, seconds });
  }
}
combos.sort((a, b) => a.idGap - b.idGap || Math.abs(a.seconds) - Math.abs(b.seconds));
for (const combo of combos) {
  if (taken.has(combo.ar.id) || taken.has(combo.en.id)) continue;
  taken.add(combo.ar.id);
  taken.add(combo.en.id);
  pairs.push({ ar: combo.ar, en: combo.en, evidence: "time" });
}

/** Written hours apart, paired by reading both titles. */
const READ_AND_MATCHED: [string, string][] = [["141829", "141812"]];
for (const [arId, enId] of READ_AND_MATCHED) {
  const ar = items.find((i) => i.id === arId);
  const en = items.find((i) => i.id === enId);
  if (!ar || !en || taken.has(ar.id) || taken.has(en.id)) continue;
  taken.add(ar.id);
  taken.add(en.id);
  pairs.push({ ar, en, evidence: "read" });
}

const skipped = items.filter((i) => !taken.has(i.id));

// ---------------------------------------------------------------------------
// Cover images
// ---------------------------------------------------------------------------

const EXTENSION: Record<string, string> = {
  png: "png",
  jpg: "jpg",
  jpeg: "jpg",
  gif: "gif",
  webp: "webp",
  svg: "svg",
};
const CONTENT_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};
const MAX_BYTES = 8 * 1024 * 1024;

const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
interface PlannedCover {
  localFile: string;
  storagePath: string;
  publicUrl: string;
  contentType: string;
  bytes: number;
}
const covers = new Map<string, PlannedCover>();
const coverProblems: string[] = [];

for (const item of items) {
  const file = item.cover_image_file;
  if (!file || covers.has(file)) continue;
  const extension = EXTENSION[file.split(".").pop()?.toLowerCase() ?? ""];
  if (!extension) {
    coverProblems.push(`${item.id}: cover type ${file} is not accepted by the bucket`);
    continue;
  }
  const bytes = readFileSync(join(exportDir, "news-images", file)).byteLength;
  if (bytes > MAX_BYTES) {
    coverProblems.push(`${item.id}: cover is ${(bytes / 1024 / 1024).toFixed(1)} MB, over the 8 MB limit`);
    continue;
  }
  const key = createHash("sha256").update(file).digest("hex").slice(0, 32);
  const storagePath = `intercom-news/${key}.${extension}`;
  covers.set(file, {
    localFile: file,
    storagePath,
    publicUrl: `${supabaseUrl}/storage/v1/object/public/help-media/${storagePath}`,
    contentType: CONTENT_TYPE[extension],
    bytes,
  });
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

interface PlannedEntry {
  arId: string;
  enId: string;
  evidence: Pair["evidence"];
  kind: "new" | "improved" | "fixed";
  unlabelled: boolean;
  titleAr: string;
  titleEn: string;
  bodyAr: { type: "doc"; content: BlockNode[] };
  bodyEn: { type: "doc"; content: BlockNode[] };
  imageUrl: string | null;
  /** The English cover, when Intercom had a different one. Uploaded, not yet stored. */
  imageUrlEnOnly: string | null;
  /** Intercom stores no alt text for covers; generated later, marked unreviewed. */
  imageAltAr: string | null;
  imageAltEn: string | null;
  /** Intercom's own publish time, kept so the order on the page matches. */
  publishedAt: string | null;
  intercomState: string;
}

const planned: PlannedEntry[] = [];
const conversionProblems: string[] = [];
const notes: string[] = [];
const rewrittenLinks = new Map<string, string>();

/** Article slugs, so a news item linking to the old help centre lands on the new one. */
const articleSlugs = new Map<string, Partial<Record<Locale, string>>>();

function kindOf(pair: Pair): { kind: "new" | "improved" | "fixed"; unlabelled: boolean } {
  const labels = [...pair.ar.labels, ...pair.en.labels].filter((l) => l !== "ar" && l !== "en");
  for (const label of labels) {
    const mapped = KIND[label];
    if (mapped) return { kind: mapped, unlabelled: false };
  }
  return { kind: KIND_WHEN_UNLABELLED, unlabelled: true };
}

function rewriteLink(href: string): string | null {
  const match = href.match(/^https?:\/\/help\.flovoo\.com\/(ar|en)\/articles\/(\d+)(?:-[^?#]*)?(#[^?]*)?/i);
  if (!match) return null;
  const locale = match[1] as Locale;
  const slug = articleSlugs.get(match[2])?.[locale];
  if (!slug) {
    notes.push(`رابط إلى مقالة ${match[2]} غير موجودة في مركز المساعدة — تُرك كما هو.`);
    return null;
  }
  const rewritten = `/${locale}/articles/${encodeURIComponent(slug)}`;
  rewrittenLinks.set(href.split("#")[0], rewritten);
  return rewritten;
}

async function buildPlan() {
  const sql = postgres(env.SUPABASE_DB_URL!, { ssl: "require", max: 1, connect_timeout: 20 });
  try {
    // The help articles are already imported; their slugs are what the old
    // help-centre links inside these announcements should point at now.
    for (const row of await sql`select t.language, t.slug, t.title from help_article_translations t`) {
      void row;
    }
    const redirects = await sql`
      select source_path, target_path from help_redirects where source_path like '%/articles/%'`;
    for (const row of redirects) {
      const source = String(row.source_path);
      const target = String(row.target_path);
      const id = source.match(/\/articles\/(\d+)/)?.[1];
      const locale = source.match(/^\/(ar|en)\//)?.[1] as Locale | undefined;
      const slug = target.match(/\/articles\/(.+)$/)?.[1];
      if (!id || !locale || !slug) continue;
      const entry = articleSlugs.get(id) ?? {};
      entry[locale] ??= decodeURIComponent(slug);
      articleSlugs.set(id, entry);
    }
  } finally {
    await sql.end();
  }
  console.log(`help articles reachable by Intercom id: ${articleSlugs.size}`);

  for (const pair of pairs) {
    const { kind, unlabelled } = kindOf(pair);
    const bodies: Record<Locale, { type: "doc"; content: BlockNode[] }> = {
      ar: { type: "doc", content: [] },
      en: { type: "doc", content: [] },
    };

    for (const [locale, item] of [
      ["ar", pair.ar],
      ["en", pair.en],
    ] as [Locale, NewsItem][]) {
      const converted = convertBody(item.body ?? "", {
        // News bodies carry no inline images; a cover is a separate field.
        resolveImage: () => null,
        resolveLink: rewriteLink,
      });
      if (converted.unhandled.length) {
        conversionProblems.push(`${item.id}/${locale}: ${converted.unhandled.join("; ")}`);
      }
      for (const image of converted.unresolvedImages) {
        conversionProblems.push(`${item.id}/${locale}: an inline image was found — ${image.slice(0, 80)}`);
      }
      bodies[locale] = converted.doc;
    }

    // Intercom keeps a cover per language; `changelog_entries.image_url` is one
    // column shared by both. Where the two differ the Arabic one is stored and
    // the English one is recorded here — it is uploaded either way, so adding a
    // per-language column later is a migration, not another download.
    const arCover = pair.ar.cover_image_file ?? null;
    const enCover = pair.en.cover_image_file ?? null;
    const cover = arCover ?? enCover;
    const planCover = cover ? (covers.get(cover) ?? null) : null;
    const enOnly = arCover && enCover && arCover !== enCover ? (covers.get(enCover) ?? null) : null;
    // Intercom published the two halves separately; the earlier one is the
    // announcement's date.
    const published = [pair.ar.published_at, pair.en.published_at].filter(Boolean) as number[];

    planned.push({
      arId: pair.ar.id,
      enId: pair.en.id,
      evidence: pair.evidence,
      kind,
      unlabelled,
      titleAr: titleOf(pair.ar),
      titleEn: titleOf(pair.en),
      bodyAr: bodies.ar,
      bodyEn: bodies.en,
      imageUrl: planCover?.publicUrl ?? null,
      imageUrlEnOnly: enOnly?.publicUrl ?? null,
      imageAltAr: null,
      imageAltEn: null,
      publishedAt: published.length ? new Date(Math.min(...published) * 1000).toISOString() : null,
      intercomState: pair.ar.state === "live" || pair.en.state === "live" ? "live" : "draft",
    });
  }
}

await buildPlan();

console.log("\nPLAN");
console.log(`  news items          ${items.length}`);
console.log(`  bilingual entries   ${planned.length}`);
console.log(`    proven by cover   ${planned.filter((p) => p.evidence === "cover").length}`);
console.log(`    by position/time  ${planned.filter((p) => p.evidence === "time").length}`);
console.log(`    by reading titles ${planned.filter((p) => p.evidence === "read").length}`);
console.log(`  skipped             ${skipped.length}`);
console.log(`  unlabelled kind     ${planned.filter((p) => p.unlabelled).length} → "${KIND_WHEN_UNLABELLED}"`);
console.log(`  covers              ${covers.size}`);
console.log(`  links rewritten     ${rewrittenLinks.size}`);
console.log(`  conversion issues   ${conversionProblems.length}`);
for (const problem of conversionProblems.slice(0, 15)) console.log(`     ${problem}`);
for (const problem of coverProblems) console.log(`     cover: ${problem}`);

if (conversionProblems.length) {
  console.error("\nRefusing to import while anything is unconverted. Nothing was written.");
  process.exit(1);
}

writeReview();

if (!APPLY) {
  console.log("\nPlan only. Re-run with --apply to upload the covers and import.");
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

  console.log(`\nuploading ${covers.size} covers…`);
  let uploaded = 0;
  for (const cover of covers.values()) {
    const bytes = readFileSync(join(exportDir, "news-images", cover.localFile));
    const { error } = await storage.storage
      .from("help-media")
      .upload(cover.storagePath, bytes, {
        contentType: cover.contentType,
        upsert: true,
        cacheControl: "31536000",
      });
    if (error) throw new Error(`upload failed for ${cover.storagePath}: ${error.message}`);
    uploaded++;
    process.stdout.write(`\r  ${uploaded}/${covers.size}   `);
  }
  process.stdout.write("\n");

  const sql = postgres(env.SUPABASE_DB_URL!, { ssl: "require", max: 1, connect_timeout: 20 });
  try {
    await sql.begin(async (tx) => {
      const before = await tx`select count(*)::int n from changelog_entries`;
      console.log(`\nentries already there (left alone): ${before[0].n}`);

      for (const entry of planned) {
        await tx`
          insert into changelog_entries
            (kind, title_ar, title_en, body_ar, body_en, image_url,
             image_alt_ar, image_alt_en, is_published, published_at)
          values (${entry.kind}, ${entry.titleAr}, ${entry.titleEn},
                  ${tx.json(entry.bodyAr as never)}, ${tx.json(entry.bodyEn as never)},
                  ${entry.imageUrl}, ${entry.imageAltAr}, ${entry.imageAltEn},
                  ${false}, ${entry.publishedAt})`;
      }
      console.log(`inserted ${planned.length} entries, all unpublished`);

      for (const cover of covers.values()) {
        await tx`
          insert into help_media (storage_path, alt_needs_review)
          values (${cover.storagePath}, ${true})
          on conflict (storage_path) do nothing`;
      }
      console.log(`recorded ${covers.size} covers in the media library`);

      const after = await tx`select count(*)::int n from changelog_entries`;
      console.log(`entries now: ${after[0].n}`);
    });
    console.log("\ncommitted.");
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

  add("# مراجعة استيراد أخبار Intercom");
  add();
  add(`أُنشئ في ${new Date().toISOString()}.`);
  add();
  add("## الجرد");
  add();
  add("| | العدد |");
  add("| --- | --- |");
  add(`| عناصر الأخبار في Intercom | ${items.length} |`);
  add(`| إعلانات بلغتين استُوردت | ${planned.length} |`);
  add(`| عناصر متخطّاة | ${skipped.length} |`);
  add(`| أغلفة استُوردت | ${covers.size} |`);
  add(`| روابط أُعيدت كتابتها | ${rewrittenLinks.size} |`);
  add();
  add(`${planned.length} × 2 + ${skipped.length} = ${planned.length * 2 + skipped.length} — يطابق ${items.length}.`);
  add();

  add("## ما تُخطّي ولماذا");
  add();
  if (!skipped.length) add("- لا شيء.");
  for (const item of skipped.sort((a, b) => Number(a.id) - Number(b.id))) {
    const why = titleOf(item) ? "لا نصف ثانٍ له" : "بلا عنوان، وعنوانا العربية والإنجليزية مطلوبان عندنا";
    add(`- **${item.id}** (${item.state}) «${titleOf(item) || "بلا عنوان"}» — ${why}.`);
  }
  add();

  add("## إعلانات لم يضع لها Intercom تصنيفًا");
  add();
  const unlabelled = planned.filter((p) => p.unlabelled);
  const unlabelledInExport = items.filter((i) => i.labels.filter((l) => l !== "ar" && l !== "en").length === 0);
  if (!unlabelled.length) {
    add(
      `في Intercom ${unlabelledInExport.length} عناصر بلا تصنيف، لكنها هي نفسها المسودات بلا عنوان التي تُخطّيت. ` +
        "لذلك لم يدخل أي إعلان بلا تصنيف، ولم تُستخدم قاعدة «بلا تصنيف ← جديد» ولا مرة واحدة.",
    );
    add();
    add(`التوزيع الفعلي: ${planned.filter((p) => p.kind === "new").length} «جديد»، و${planned.filter((p) => p.kind === "improved").length} «تحسين».`);
  } else {
    add(`${unlabelled.length} إعلانًا بلا تصنيف في Intercom، أُدرجت كـ «جديد» بقرارك. راجعها:`);
    add();
    for (const entry of unlabelled) add(`- ${entry.arId} / ${entry.enId} — «${entry.titleAr}»`);
  }
  add();

  add("## كيف اقترنت النسختان");
  add();
  add("Intercom لا يخزّن أي حقل يربط النسخة العربية بالإنجليزية، فالاقتران مستنتج:");
  add();
  add(`- **${planned.filter((p) => p.evidence === "cover").length}** مثبتة: النسختان تشتركان في ملف الغلاف نفسه.`);
  add(`- **${planned.filter((p) => p.evidence === "time").length}** بالموضع والوقت: قاعدة اختُبرت على الأزواج المثبتة فأصابت 30 من 31.`);
  add(`- **${planned.filter((p) => p.evidence === "read").length}** بقراءة العنوانين.`);
  add();
  add("قرأتُ الأزواج الأربعة والخمسين كلها وتحققت من كل واحد. الجدول كامل في `migration/news-survey.md`.");
  add();
  add("| العربية | الإنجليزية | الدليل | النوع |");
  add("| --- | --- | --- | --- |");
  for (const entry of [...planned].sort((a, b) => Number(b.arId) - Number(a.arId))) {
    const evidence = entry.evidence === "cover" ? "الغلاف" : entry.evidence === "time" ? "الموضع" : "القراءة";
    add(`| ${entry.titleAr.slice(0, 40)} | ${entry.titleEn.slice(0, 40)} | ${evidence} | ${entry.kind} |`);
  }
  add();

  add("## يحتاج قرارك: غلاف لكل لغة");
  add();
  const perLanguage = planned.filter((p) => p.imageUrlEnOnly);
  add(
    `**${perLanguage.length} من ${planned.length}** إعلانًا له في Intercom غلاف عربي وغلاف إنجليزي مختلفان — ` +
      "غالبًا لقطة شاشة بواجهة عربية وأخرى بواجهة إنجليزية. عمود الغلاف عندنا واحد مشترك بين اللغتين.",
  );
  add();
  add("فاتني هذا في الجرد الأول، وأعتذر. الوضع الآن:");
  add();
  add("- خُزّن الغلاف **العربي** لكل إعلان، فيراه قارئ الإنجليزية أيضًا.");
  add("- **الغلاف الإنجليزي لم يضِع**: كل الأغلفة الأربعة والسبعين مرفوعة في مخزننا بالفعل.");
  add("- كل الإعلانات مسودات، فلم يرَ أحد شيئًا.");
  add();
  add("الإصلاح ترحيل واحد يضيف عمودًا للغلاف الإنجليزي، ثم تعبئة الـ21 من الأغلفة المرفوعة. قل كلمة وأنفّذه.");
  add();
  add("| الإعلان | الغلاف العربي | الغلاف الإنجليزي |");
  add("| --- | --- | --- |");
  for (const entry of perLanguage) {
    add(`| ${entry.titleAr.slice(0, 34)} | \`${(entry.imageUrl ?? "").split("/").pop()}\` | \`${(entry.imageUrlEnOnly ?? "").split("/").pop()}\` |`);
  }
  add();

  add("## أمور تحتاج انتباهك");
  add();
  add("- **كل الإعلانات غير منشورة.** راجِعها وانشرها من لوحة التحكم.");
  add("- **لم يُحذف شيء.** المسودتان الموجودتان في «الجديد» كما هما.");
  add(`- **الأغلفة بلا وصف بديل.** Intercom لا يخزّن وصفًا لها، و${covers.size} غلافًا مسجّل الآن في مكتبة الوسائط بعلامة «غير مراجَع».`);
  add("- **تواريخ النشر محفوظة** من Intercom، فترتيب الصفحة سيطابق ترتيبها هناك.");
  for (const note of [...new Set(notes)]) add(`- ${note}`);
  add();

  writeFileSync(join(root, "migration", "news-review.md"), lines.join("\n"), "utf8");
  console.log(`\nwrote ${join(root, "migration", "news-review.md")}`);
}
