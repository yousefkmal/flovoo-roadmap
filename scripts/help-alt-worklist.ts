/**
 * Builds the list of pictures that still need a description, with the context
 * needed to write one: which article they sit in, in which language, and the
 * text immediately around them.
 *
 *   npm run help:alt-worklist
 *
 * Writes `migration/alt-worklist.json`. Reading the surrounding text matters —
 * a screenshot of a settings page is described differently in a guide about
 * billing than in one about templates.
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

interface Node {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  text?: string;
}

const plain = (node: Node): string =>
  node.type === "text" ? (node.text ?? "") : (node.content ?? []).map(plain).join("");

async function main() {
  const env = loadEnv();
  const sql = postgres(env.SUPABASE_DB_URL!, { ssl: "require", max: 1, connect_timeout: 20 });

  const rows = await sql`
    select t.article_id, t.language, t.slug, t.title, t.body, c.slug collection
      from help_article_translations t
      join help_articles a on a.id = t.article_id
      join help_collections c on c.id = a.collection_id
     order by t.language, t.slug`;

  interface Job {
    articleId: string;
    language: string;
    articleSlug: string;
    articleTitle: string;
    collection: string;
    /** Index of this figure among the figures of this translation. */
    position: number;
    storagePath: string;
    localFile: string;
    /** The nearest heading above, and the paragraph before and after. */
    heading: string | null;
    before: string;
    after: string;
  }

  const jobs: Job[] = [];

  for (const row of rows) {
    const body = row.body as Node;
    let heading: string | null = null;
    let position = 0;

    // Figures are not always top-level: some sit inside a list item or a
    // callout. Walking only the outer blocks missed 28 of them.
    const walk = (nodes: Node[]) => {
      for (const [index, node] of nodes.entries()) {
        if (node.type === "heading") {
          heading = plain(node).trim() || heading;
          continue;
        }
        if (node.type === "figure") {
          const src = String(node.attrs?.src ?? "");
          const storagePath = src.split("/help-media/")[1] ?? "";
          if (!storagePath) continue;
          const textOf = (n: Node | undefined) =>
            n && n.type !== "figure" ? plain(n).trim().slice(0, 300) : "";
          jobs.push({
            articleId: row.article_id as string,
            language: row.language as string,
            articleSlug: row.slug as string,
            articleTitle: row.title as string,
            collection: row.collection as string,
            position: position++,
            storagePath,
            // `intercom/<key>.<ext>` is named after the source URL's hash, and
            // the downloaded file on disk carries the same name.
            localFile: storagePath.split("/")[1],
            heading,
            before: textOf(nodes[index - 1]) || textOf(nodes[index - 2]),
            after: textOf(nodes[index + 1]) || textOf(nodes[index + 2]),
          });
          continue;
        }
        if (node.content?.length) walk(node.content);
      }
    };
    walk(body.content ?? []);
  }

  writeFileSync(join(root, "migration", "alt-worklist.json"), JSON.stringify(jobs, null, 2), "utf8");
  console.log(`${jobs.length} pictures need a description`);
  console.log(`  Arabic:  ${jobs.filter((j) => j.language === "ar").length}`);
  console.log(`  English: ${jobs.filter((j) => j.language === "en").length}`);
  console.log(`  distinct files: ${new Set(jobs.map((j) => j.localFile)).size}`);
  console.log(`wrote migration/alt-worklist.json`);
  await sql.end();
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
