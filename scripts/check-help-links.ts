/**
 * Does every old Intercom address still land on something a reader can see?
 *
 *   npm run check:help-links
 *
 * This is the check that cannot be run before the content is published, and
 * the one that decides whether `help.flovoo.com` is safe to point away from
 * Intercom. It resolves every stored redirect the way the pages do, then asks
 * whether the target is actually reachable: published article, in a published
 * topic. A target that is still a draft returns 404 to a reader.
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

async function main() {
  const env = loadEnv();
  const sql = postgres(env.SUPABASE_DB_URL!, { ssl: "require", max: 1, connect_timeout: 20 });
  try {
    const redirects = await sql`select source_path, target_path from help_redirects`;

    // Reachable = published article whose topic is published, per language.
    const articles = await sql`
      select t.language, t.slug, a.status, c.is_published
        from help_article_translations t
        join help_articles a on a.id = t.article_id
        join help_collections c on c.id = a.collection_id`;
    const reachableArticles = new Set(
      articles.filter((a) => a.status === "published" && a.is_published).map((a) => `${a.language}:${a.slug}`),
    );
    const allArticles = new Set(articles.map((a) => `${a.language}:${a.slug}`));

    const collections = await sql`select slug, is_published from help_collections`;
    const reachableCollections = new Set(collections.filter((c) => c.is_published).map((c) => c.slug));
    const allCollections = new Set(collections.map((c) => String(c.slug)));

    let ok = 0;
    const draftTarget: string[] = [];
    const missingTarget: string[] = [];
    const unrecognised: string[] = [];

    for (const row of redirects) {
      const target = String(row.target_path);
      const source = String(row.source_path);
      const match = target.match(/^\/(ar|en)\/(articles|categories)\/(.+)$/);
      if (!match) {
        unrecognised.push(`${source} → ${target}`);
        continue;
      }
      const [, language, kind, rawSlug] = match;
      const slug = decodeURIComponent(rawSlug);

      if (kind === "articles") {
        if (reachableArticles.has(`${language}:${slug}`)) ok++;
        else if (allArticles.has(`${language}:${slug}`)) draftTarget.push(`${source} → ${target}`);
        else missingTarget.push(`${source} → ${target}`);
      } else {
        if (reachableCollections.has(slug)) ok++;
        else if (allCollections.has(slug)) draftTarget.push(`${source} → ${target}`);
        else missingTarget.push(`${source} → ${target}`);
      }
    }

    console.log(`old addresses stored: ${redirects.length}`);
    console.log(`  land on something a reader can see: ${ok}`);
    console.log(`  land on a draft or hidden topic (404 today): ${draftTarget.length}`);
    console.log(`  point at nothing at all: ${missingTarget.length}`);
    console.log(`  unrecognised target shape: ${unrecognised.length}`);

    const show = (label: string, list: string[]) => {
      if (!list.length) return;
      console.log(`\n${label}:`);
      for (const line of list.slice(0, 25)) console.log(`   ${decodeURIComponent(line)}`);
      if (list.length > 25) console.log(`   … and ${list.length - 25} more`);
    };
    show("would 404 for a reader", draftTarget);
    show("target does not exist", missingTarget);
    show("unrecognised", unrecognised);

    if (missingTarget.length || unrecognised.length) {
      console.log("\nBROKEN: a redirect points at something that is not there.");
      process.exitCode = 1;
    } else if (draftTarget.length) {
      console.log("\nNOT READY: every target exists, but some are not published yet.");
      process.exitCode = 1;
    } else {
      console.log("\nReady: every old address reaches a live page.");
    }
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
