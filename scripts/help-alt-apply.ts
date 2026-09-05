/**
 * Writes the generated image descriptions into the article bodies and the
 * media library, marked as unreviewed.
 *
 *   npm run help:alt-apply            plan only
 *   npm run help:alt-apply -- --apply
 *
 * Each figure gets `alt` plus `altDraft: true`. The draft flag is what stops a
 * generated description reaching a reader: publishing refuses a figure that
 * still carries it (`figureWithoutAlt` in the help admin actions), and the
 * editor shows an "unreviewed" badge that clears the moment somebody edits the
 * field. `help_media.alt_needs_review` records the same thing per picture so
 * the library can list what still needs a human.
 */
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

interface Node {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  text?: string;
}

interface Job {
  articleId: string;
  language: string;
  articleSlug: string;
  position: number;
  storagePath: string;
}

async function main() {
  const env = loadEnv();
  const jobs = JSON.parse(readFileSync(join(root, "migration/alt-worklist.json"), "utf8")) as Job[];
  const texts = JSON.parse(readFileSync(join(root, "migration/alt-texts.json"), "utf8")) as Record<string, string>;

  // One description per (article, language, position) — the same picture used
  // twice in one article is described once per place it appears.
  const byPlace = new Map<string, string>();
  const byStoragePath = new Map<string, { ar?: string; en?: string }>();
  for (const [index, job] of jobs.entries()) {
    const text = texts[String(index).padStart(3, "0")]?.trim();
    if (!text) throw new Error(`no description for job ${index}`);
    byPlace.set(`${job.articleId}/${job.language}/${job.position}`, text);
    const media = byStoragePath.get(job.storagePath) ?? {};
    if (job.language === "ar") media.ar ??= text;
    else media.en ??= text;
    byStoragePath.set(job.storagePath, media);
  }
  console.log(`${byPlace.size} figure placements, ${byStoragePath.size} distinct pictures`);

  const sql = postgres(env.SUPABASE_DB_URL!, { ssl: "require", max: 1, connect_timeout: 20 });
  try {
    const rows = await sql`select article_id, language, slug, body from help_article_translations`;

    let described = 0;
    let alreadyWritten = 0;
    const updates: { articleId: string; language: string; body: Node }[] = [];

    for (const row of rows) {
      const body = JSON.parse(JSON.stringify(row.body)) as Node;
      let position = 0;
      let touched = false;

      const walk = (nodes: Node[]) => {
        for (const node of nodes) {
          if (node.type === "figure") {
            const key = `${row.article_id}/${row.language}/${position++}`;
            const text = byPlace.get(key);
            if (!text) continue;
            // Never overwrite something a person wrote.
            if (String(node.attrs?.alt ?? "").trim() && node.attrs?.altDraft !== true) {
              alreadyWritten++;
              continue;
            }
            node.attrs = { ...node.attrs, alt: text, altDraft: true };
            described++;
            touched = true;
            continue;
          }
          if (node.content?.length) walk(node.content);
        }
      };
      walk(body.content ?? []);
      if (touched) updates.push({ articleId: row.article_id as string, language: row.language as string, body });
    }

    console.log(`figures to describe: ${described}`);
    console.log(`figures left alone (already described by a person): ${alreadyWritten}`);
    console.log(`translations to update: ${updates.length}`);

    if (!APPLY) {
      console.log("\nPlan only. Re-run with --apply to write.");
      return;
    }

    await sql.begin(async (tx) => {
      for (const update of updates) {
        await tx`
          update help_article_translations
             set body = ${tx.json(update.body as never)}
           where article_id = ${update.articleId} and language = ${update.language}`;
      }
      for (const [storagePath, alt] of byStoragePath) {
        await tx`
          update help_media
             set alt_ar = coalesce(${alt.ar ?? null}, alt_ar),
                 alt_en = coalesce(${alt.en ?? null}, alt_en),
                 alt_needs_review = true
           where storage_path = ${storagePath}`;
      }
    });
    console.log(`\ncommitted: ${updates.length} translations, ${byStoragePath.size} media rows.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
