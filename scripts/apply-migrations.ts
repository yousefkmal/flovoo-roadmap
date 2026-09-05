/**
 * Applies pending SQL migrations (and, on request, the help-center seed) to the
 * Supabase project named by `SUPABASE_DB_URL` in `.env.local`.
 *
 *   node --experimental-strip-types --no-warnings scripts/apply-migrations.ts
 *   node --experimental-strip-types --no-warnings scripts/apply-migrations.ts --seed-help
 *
 * Bookkeeping lives in `public.app_migrations`. Migrations that predate the
 * table are recognised by a marker object each one creates, so a project that
 * already runs the roadmap is not asked to re-run 0001–0004. Each migration
 * runs inside its own transaction: it applies completely or not at all.
 *
 * The roadmap seed (`seed.sql`) is deliberately NOT applied here — it deletes
 * roadmap tables first and exists for local development only.
 */
import { readdirSync, readFileSync } from "node:fs";
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

/** Something each migration creates, to recognise it on a database that ran it before this script existed. */
const MARKERS: Record<string, string> = {
  "0001_init.sql": "select 1 from information_schema.tables where table_schema='public' and table_name='categories'",
  "0002_accounts.sql": "select 1 from information_schema.tables where table_schema='public' and table_name='profiles'",
  "0003_changelog.sql": "select 1 from pg_type where typname='changelog_kind'",
  "0004_changelog_links.sql": "select 1 from information_schema.columns where table_schema='public' and table_name='changelog_entries' and column_name='article_url'",
  "0005_help_center.sql": "select 1 from information_schema.tables where table_schema='public' and table_name='help_collections'",
  "0006_help_search.sql": "select 1 from pg_proc where proname='help_search'",
};

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL is not set in .env.local");

  const seedHelp = process.argv.includes("--seed-help");
  const sql = postgres(url, { ssl: "require", max: 1, connect_timeout: 20 });

  try {
    await sql`
      create table if not exists public.app_migrations (
        name       text primary key,
        applied_at timestamptz not null default now(),
        note       text
      )`;

    const applied = new Set(
      (await sql`select name from public.app_migrations`).map((r) => r.name as string),
    );

    const files = readdirSync(join(root, "supabase", "migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`= ${file}  (recorded)`);
        continue;
      }
      const marker = MARKERS[file];
      if (marker) {
        const rows = await sql.unsafe(marker);
        if (rows.length > 0) {
          await sql`insert into public.app_migrations (name, note) values (${file}, 'detected as already applied')`;
          console.log(`= ${file}  (already applied, recorded)`);
          continue;
        }
      }
      const text = readFileSync(join(root, "supabase", "migrations", file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(text);
        await tx`insert into public.app_migrations (name) values (${file})`;
      });
      console.log(`+ ${file}  applied`);
    }

    if (seedHelp) {
      const text = readFileSync(join(root, "supabase", "seed-help.sql"), "utf8")
        // The file carries its own begin/commit; the transaction below owns that.
        .replace(/^begin;\s*$/m, "")
        .replace(/^commit;\s*$/m, "");
      await sql.begin(async (tx) => {
        await tx.unsafe(text);
      });
      const [{ collections, articles, translations }] = await sql`
        select
          (select count(*) from help_collections)::int as collections,
          (select count(*) from help_articles)::int as articles,
          (select count(*) from help_article_translations)::int as translations`;
      console.log(`+ seed-help.sql applied: ${collections} collections, ${articles} articles, ${translations} translations`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
