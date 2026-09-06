/**
 * Builds the list of published articles whose answer summary is still empty,
 * with enough of the article to write one.
 *
 *   npm run help:summary-worklist
 *
 * Writes `migration/summary-worklist.json`. The summary is the paragraph a
 * retrieval system reads first, so it has to answer the article's question in
 * the article's own words — which means reading the article, not the title.
 * The body is trimmed to the opening, which is where the answer nearly always
 * is; anything longer would not fit the work and would not help.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import postgres from "postgres";

const root = join(import.meta.dirname, "..");

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

const url = loadEnv().SUPABASE_DB_URL;
if (!url) throw new Error("SUPABASE_DB_URL is not set in .env.local");

const BODY_CHARS = 1400;

async function main() {
  const sql = postgres(url, { prepare: false });
  const rows = await sql`
    select t.id,
           t.article_id,
           t.language,
           t.slug,
           t.title,
           t.excerpt,
           t.body_plain,
           t.answer_summary,
           t.summary_needs_review,
           a.status,
           case when t.language = 'ar' then c.name_ar else c.name_en end as collection
      from help_article_translations t
      join help_articles a on a.id = t.article_id
      join help_collections c on c.id = a.collection_id
     where a.status = 'published'
     order by c.slug, t.language, t.title`;
  await sql.end();

  const pending = rows.filter(
    (r) => !String(r.answer_summary ?? "").trim() || r.summary_needs_review === true,
  );

  const worklist = pending.map((r) => ({
    translation_id: r.id,
    article_id: r.article_id,
    language: r.language,
    collection: r.collection,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    // The opening of the article: where the answer lives.
    body_opening: String(r.body_plain ?? "").slice(0, BODY_CHARS),
    body_chars_total: String(r.body_plain ?? "").length,
    // Filled in by hand, then applied with help:summary-apply.
    answer_summary: "",
  }));

  const out = join(root, "migration", "summary-worklist.json");
  writeFileSync(out, JSON.stringify(worklist, null, 2), "utf8");

  const byLanguage = (language: string) => worklist.filter((w) => w.language === language).length;
  console.log(`published translations: ${rows.length}`);
  console.log(`still needing a summary: ${worklist.length} (ar ${byLanguage("ar")}, en ${byLanguage("en")})`);
  console.log(`wrote ${out}`);
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
