/**
 * Writes the drafted answer summaries back, marked unreviewed.
 *
 *   npm run help:summary-apply            # check only, writes nothing
 *   npm run help:summary-apply -- --apply
 *
 * Reads `migration/summary-worklist.json`. Every summary lands with
 * `summary_needs_review = true`, which means the public pages, the `.md`
 * endpoint and `llms.txt` keep showing the excerpt and publishing still
 * refuses to count it — a draft is invisible until somebody approves it in
 * the editor.
 *
 * All of it is one transaction: a partial pass would leave the article list
 * showing badges for summaries that were never written.
 */
import { readFileSync } from "node:fs";
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

const apply = process.argv.includes("--apply");

/** The bounds the editor and the database both enforce. Checked here first. */
const WORDS = { hardMin: 25, hardMax: 110 };
const CHARS = { min: 80, max: 700 };

interface Entry {
  translation_id: string;
  language: string;
  title: string;
  answer_summary: string;
}

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Arabic and Latin openers that leave a lifted paragraph dangling. */
const OPENERS: Record<string, string[]> = {
  ar: ["هذا", "هذه", "ذلك", "تلك", "هنا", "هناك", "كما", "لذلك", "وهو", "وهي", "به", "بها"],
  en: ["this", "that", "these", "those", "it", "here", "there", "also", "such"],
};

function startsWithReference(text: string, language: string): boolean {
  const first = text.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^\p{L}]/gu, "") ?? "";
  return (OPENERS[language] ?? []).some((opener) => first === opener.toLowerCase());
}

async function main() {
  const path = join(root, "migration", "summary-worklist.json");
  const entries = JSON.parse(readFileSync(path, "utf8")) as Entry[];

  const filled = entries.filter((e) => String(e.answer_summary ?? "").trim());
  const problems: string[] = [];

  for (const entry of filled) {
    const summary = entry.answer_summary.trim();
    const words = wordCount(summary);
    const where = `${entry.language} · ${entry.title}`;
    if (words < WORDS.hardMin || words > WORDS.hardMax) {
      problems.push(`${where}: ${words} words, must be ${WORDS.hardMin}-${WORDS.hardMax}`);
    }
    if (summary.length < CHARS.min || summary.length > CHARS.max) {
      problems.push(`${where}: ${summary.length} characters, must be ${CHARS.min}-${CHARS.max}`);
    }
    if (startsWithReference(summary, entry.language)) {
      problems.push(`${where}: opens with a reference word — a lifted paragraph has nothing to refer back to`);
    }
  }

  console.log(`entries: ${entries.length}`);
  console.log(`filled in: ${filled.length}`);
  console.log(`problems: ${problems.length}`);
  for (const problem of problems) console.log(`  ${problem}`);

  if (problems.length) {
    console.log("\nNothing written. Fix the problems above and run again.");
    process.exitCode = 1;
    return;
  }
  if (!apply) {
    console.log("\nCheck only. Re-run with -- --apply to write.");
    return;
  }

  const sql = postgres(url, { prepare: false });
  let written = 0;
  await sql.begin(async (tx) => {
    for (const entry of filled) {
      const rows = await tx`
        update help_article_translations
           set answer_summary = ${entry.answer_summary.trim()},
               summary_needs_review = true
         where id = ${entry.translation_id}
        returning id`;
      if (rows.length !== 1) {
        throw new Error(`${entry.title}: expected 1 row, got ${rows.length} — rolled back`);
      }
      written++;
    }
  });
  await sql.end();
  console.log(`\nwrote ${written} summaries, all marked unreviewed`);
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
