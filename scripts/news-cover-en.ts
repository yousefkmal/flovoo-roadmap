/**
 * Fills `changelog_entries.image_url_en` for the announcements whose English
 * half had its own cover in Intercom.
 *
 *   npm run news:cover-en            plan only
 *   npm run news:cover-en -- --apply
 *
 * The covers were all uploaded by the news import, so this only points rows at
 * files that already exist. It repeats the same pairing rules the import used
 * (see `intercom-news-import.ts`), then matches each pair to its row by title
 * and Arabic cover — the pair of duplicate announcements share a title, so the
 * cover is what tells them apart.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import postgres from "postgres";

const root = join(import.meta.dirname, "..");
const exportDir = join(root, "migration", "intercom-export");
const APPLY = process.argv.includes("--apply");

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

const ARABIC_FEED = 102840;
const ENGLISH_FEED = 102841;

interface NewsItem {
  id: string;
  title: string | null;
  cover_image_file?: string | null;
  created_at: number;
  labels: string[];
  newsfeed_assignments: { newsfeed_id: number }[];
}

const items = (
  JSON.parse(readFileSync(join(exportDir, "intercom-news.json"), "utf8")) as { news_items: NewsItem[] }
).news_items;

function languageOf(item: NewsItem): "ar" | "en" | null {
  const feeds = new Set(item.newsfeed_assignments.map((a) => a.newsfeed_id));
  if (feeds.has(ARABIC_FEED)) return "ar";
  if (feeds.has(ENGLISH_FEED)) return "en";
  if (item.labels.includes("ar")) return "ar";
  if (item.labels.includes("en")) return "en";
  return null;
}

// -- the same pairing the import used ---------------------------------------
const pairs: { ar: NewsItem; en: NewsItem }[] = [];
const taken = new Set<string>();

const byCover = new Map<string, NewsItem[]>();
for (const item of items) {
  if (!item.cover_image_file) continue;
  byCover.set(item.cover_image_file, [...(byCover.get(item.cover_image_file) ?? []), item]);
}
for (const group of byCover.values()) {
  if (group.length !== 2) continue;
  const ar = group.find((i) => languageOf(i) === "ar");
  const en = group.find((i) => languageOf(i) === "en");
  if (!ar || !en || taken.has(ar.id) || taken.has(en.id)) continue;
  taken.add(ar.id);
  taken.add(en.id);
  pairs.push({ ar, en });
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
  pairs.push({ ar: combo.ar, en: combo.en });
}
for (const [arId, enId] of [["141829", "141812"]]) {
  const ar = items.find((i) => i.id === arId);
  const en = items.find((i) => i.id === enId);
  if (ar && en && !taken.has(ar.id) && !taken.has(en.id)) {
    taken.add(ar.id);
    taken.add(en.id);
    pairs.push({ ar, en });
  }
}

const EXTENSION: Record<string, string> = { png: "png", jpg: "jpg", jpeg: "jpg", gif: "gif", webp: "webp", svg: "svg" };
const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const publicUrlOf = (localFile: string): string | null => {
  const extension = EXTENSION[localFile.split(".").pop()?.toLowerCase() ?? ""];
  if (!extension) return null;
  const key = createHash("sha256").update(localFile).digest("hex").slice(0, 32);
  return `${supabaseUrl}/storage/v1/object/public/help-media/intercom-news/${key}.${extension}`;
};

const differing = pairs.filter(
  (p) => p.ar.cover_image_file && p.en.cover_image_file && p.ar.cover_image_file !== p.en.cover_image_file,
);
console.log(`pairs: ${pairs.length}, with a different cover per language: ${differing.length}`);

async function main() {
  const sql = postgres(env.SUPABASE_DB_URL!, { ssl: "require", max: 1, connect_timeout: 20 });
  try {
    const rows = await sql`select id, title_ar, title_en, image_url, image_url_en from changelog_entries`;

    const updates: { id: string; url: string; title: string }[] = [];
    const unmatched: string[] = [];
    for (const pair of differing) {
      const arUrl = publicUrlOf(pair.ar.cover_image_file!);
      const enUrl = publicUrlOf(pair.en.cover_image_file!);
      if (!arUrl || !enUrl) {
        unmatched.push(`${pair.ar.id}: cover type not accepted`);
        continue;
      }
      // Title alone is not unique — two announcements are duplicates of each
      // other — so the Arabic cover is what identifies the row.
      const row = rows.find(
        (r) => String(r.title_ar) === (pair.ar.title ?? "").trim() && String(r.image_url) === arUrl,
      );
      if (!row) {
        unmatched.push(`${pair.ar.id} "${(pair.ar.title ?? "").slice(0, 40)}": no row matched`);
        continue;
      }
      if (row.image_url_en) continue; // already set
      updates.push({ id: row.id as string, url: enUrl, title: String(row.title_ar).slice(0, 40) });
    }

    console.log(`rows to update: ${updates.length}`);
    for (const update of updates) console.log(`   ${update.title}`);
    if (unmatched.length) {
      console.log(`\nunmatched (${unmatched.length}):`);
      for (const line of unmatched) console.log(`   ${line}`);
    }

    if (!APPLY) {
      console.log("\nPlan only. Re-run with --apply to write.");
      return;
    }
    if (unmatched.length) {
      console.error("\nRefusing to write while anything is unmatched.");
      process.exitCode = 1;
      return;
    }

    await sql.begin(async (tx) => {
      for (const update of updates) {
        await tx`update changelog_entries set image_url_en = ${update.url} where id = ${update.id}`;
      }
    });
    console.log(`\ncommitted: ${updates.length} rows.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
