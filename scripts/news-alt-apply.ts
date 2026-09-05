/**
 * Writes the generated cover descriptions onto the imported changelog entries
 * and their media rows.
 *
 *   npm run news:alt-apply            plan only
 *   npm run news:alt-apply -- --apply
 *
 * Intercom stores no alt text for news covers, so these are machine-written.
 * `help_media.alt_needs_review` stays true, which is what marks them for a
 * human. Nothing a person typed is overwritten.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import postgres from "postgres";

const root = join(import.meta.dirname, "..");
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

const EXTENSION: Record<string, string> = { png: "png", jpg: "jpg", jpeg: "jpg", gif: "gif", webp: "webp", svg: "svg" };

async function main() {
  const env = loadEnv();
  const texts = JSON.parse(readFileSync(join(root, "migration/news-alt-texts.json"), "utf8")) as Record<
    string,
    { ar: string; en: string }
  >;

  // The importer names each stored cover after a hash of its local filename.
  const byStoragePath = new Map<string, { ar: string; en: string }>();
  for (const [localFile, alt] of Object.entries(texts)) {
    const extension = EXTENSION[localFile.split(".").pop()?.toLowerCase() ?? ""];
    if (!extension) continue;
    const key = createHash("sha256").update(localFile).digest("hex").slice(0, 32);
    byStoragePath.set(`intercom-news/${key}.${extension}`, alt);
  }
  console.log(`${byStoragePath.size} covers described`);

  const sql = postgres(env.SUPABASE_DB_URL!, { ssl: "require", max: 1, connect_timeout: 20 });
  try {
    const rows = await sql`
      select id, image_url, image_url_en, image_alt_ar, image_alt_en
        from changelog_entries where image_url is not null`;

    const updates: { id: string; ar: string; en: string }[] = [];
    let alreadyWritten = 0;
    let unmatched = 0;
    for (const row of rows) {
      const arPath = String(row.image_url).split("/help-media/")[1] ?? "";
      const arAlt = byStoragePath.get(arPath);
      if (!arAlt) {
        unmatched++;
        continue;
      }
      // An entry whose English version has its own cover (migration 0013) needs
      // the English alt to describe *that* picture, not the Arabic one.
      const enPath = row.image_url_en ? (String(row.image_url_en).split("/help-media/")[1] ?? "") : arPath;
      const enAlt = byStoragePath.get(enPath);
      if (!enAlt) {
        unmatched++;
        continue;
      }
      const wanted = { ar: arAlt.ar, en: enAlt.en };
      // Never overwrite something a person typed; do correct a description this
      // script wrote earlier for a cover the entry no longer uses.
      const currentAr = String(row.image_alt_ar ?? "").trim();
      const currentEn = String(row.image_alt_en ?? "").trim();
      const machineWritten =
        !currentAr ||
        [...byStoragePath.values()].some((a) => a.ar === currentAr || a.en === currentAr);
      if (currentAr && !machineWritten) {
        alreadyWritten++;
        continue;
      }
      if (currentAr === wanted.ar && currentEn === wanted.en) continue;
      updates.push({ id: row.id as string, ...wanted });
    }

    console.log(`entries with a cover: ${rows.length}`);
    console.log(`  to describe: ${updates.length}`);
    console.log(`  left alone (already described): ${alreadyWritten}`);
    console.log(`  cover not from this import: ${unmatched}`);

    if (!APPLY) {
      console.log("\nPlan only. Re-run with --apply to write.");
      return;
    }

    await sql.begin(async (tx) => {
      for (const update of updates) {
        await tx`
          update changelog_entries
             set image_alt_ar = ${update.ar},
                 image_alt_en = ${update.en},
                 cover_alt_needs_review = ${true}
           where id = ${update.id}`;
      }
      for (const [path, alt] of byStoragePath) {
        await tx`
          update help_media
             set alt_ar = coalesce(alt_ar, ${alt.ar}),
                 alt_en = coalesce(alt_en, ${alt.en}),
                 alt_needs_review = true
           where storage_path = ${path}`;
      }
    });
    console.log(`\ncommitted: ${updates.length} entries, ${byStoragePath.size} media rows.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
