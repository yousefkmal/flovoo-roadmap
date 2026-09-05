/**
 * Pulls EVERYTHING readable out of Intercom's help centre and writes it to
 * `migration/intercom-export/` as raw JSON, untouched.
 *
 *   npm run intercom:export
 *
 * This is the safety net, not the import. It runs first and on its own so that
 * once the Intercom account is closed the content still exists on disk exactly
 * as Intercom returned it. Nothing here writes to our database, and nothing
 * here decides what is worth keeping — that judgement comes after the survey,
 * with the user.
 *
 * Read-only. The token is read from `.env.local` and never printed.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const outDir = join(root, "migration", "intercom-export");

function loadToken(): string {
  const text = readFileSync(join(root, ".env.local"), "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    if (trimmed.slice(0, eq).trim() === "INTERCOM_ACCESS_TOKEN") return trimmed.slice(eq + 1).trim();
  }
  throw new Error("INTERCOM_ACCESS_TOKEN is not set in .env.local");
}

const token = loadToken();
const HOSTS = ["api.intercom.io", "api.eu.intercom.io", "api.au.intercom.io"];
let host = HOSTS[0];

async function api<T = unknown>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `https://${host}${path}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "Intercom-Version": "2.11",
      },
      signal: AbortSignal.timeout(30000),
    });
    // Intercom rate limits at 1000/min; back off rather than lose a page.
    if (response.status === 429) {
      const wait = Number(response.headers.get("x-ratelimit-reset")) || 5;
      console.log(`   rate limited, waiting ${wait}s…`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (!response.ok) {
      throw new Error(`${response.status} on ${path}: ${(await response.text()).slice(0, 300)}`);
    }
    return (await response.json()) as T;
  }
  throw new Error(`gave up on ${path} after repeated rate limiting`);
}

interface Paged<T> {
  data?: T[];
  // Older list shapes put the rows under the type name.
  articles?: T[];
  collections?: T[];
  total_count?: number;
  pages?: { next?: string | { starting_after?: string }; page?: number; total_pages?: number };
}

/** Walks every page of a list endpoint, whichever pagination style it uses. */
async function all<T>(path: string, label: string): Promise<T[]> {
  const rows: T[] = [];
  let url: string | null = `${path}${path.includes("?") ? "&" : "?"}per_page=100`;

  while (url) {
    const page: Paged<T> = await api<Paged<T>>(url);
    const batch = page.data ?? page.articles ?? page.collections ?? [];
    rows.push(...batch);
    process.stdout.write(`\r   ${label}: ${rows.length}${page.total_count ? ` / ${page.total_count}` : ""}   `);

    const next = page.pages?.next;
    if (typeof next === "string" && next) url = next;
    else if (next && typeof next === "object" && next.starting_after) {
      url = `${path}${path.includes("?") ? "&" : "?"}per_page=100&starting_after=${next.starting_after}`;
    } else url = null;
  }
  process.stdout.write("\n");
  return rows;
}

async function main() {
  // Confirm the region before anything else; a wrong host looks like a bad token.
  let me: Record<string, unknown> | null = null;
  for (const candidate of HOSTS) {
    host = candidate;
    try {
      me = await api<Record<string, unknown>>("/me");
      break;
    } catch {
      me = null;
    }
  }
  if (!me) throw new Error("The token was rejected by every Intercom region.");
  const app = me.app as { name?: string; id_code?: string; region?: string } | undefined;
  console.log(`workspace: ${app?.name} (${app?.id_code}) · region ${app?.region} · host ${host}\n`);

  mkdirSync(outDir, { recursive: true });

  console.log("fetching:");
  const helpCenters = await all<Record<string, unknown>>("/help_center/help_centers", "help centres");
  const collections = await all<Record<string, unknown>>("/help_center/collections", "collections");
  const articles = await all<Record<string, unknown>>("/articles", "articles");

  // Admins are referenced by id on every article; resolve them so the review
  // file can name a human rather than a number.
  let admins: Record<string, unknown>[] = [];
  try {
    const response = await api<{ admins?: Record<string, unknown>[] }>("/admins");
    admins = response.admins ?? [];
    console.log(`   admins: ${admins.length}`);
  } catch (error) {
    console.log(`   admins: not readable (${(error as Error).message.slice(0, 60)}) — not fatal`);
  }

  const exported = {
    exported_at: new Date().toISOString(),
    host,
    workspace: app ?? null,
    counts: {
      help_centers: helpCenters.length,
      collections: collections.length,
      articles: articles.length,
      admins: admins.length,
    },
    help_centers: helpCenters,
    collections,
    articles,
    admins,
  };

  writeFileSync(join(outDir, "intercom-raw.json"), JSON.stringify(exported, null, 2), "utf8");
  // Each article also on its own, so a single bad row can never cost the rest.
  mkdirSync(join(outDir, "articles"), { recursive: true });
  for (const article of articles) {
    const id = String((article as { id?: string }).id ?? "unknown");
    writeFileSync(join(outDir, "articles", `${id}.json`), JSON.stringify(article, null, 2), "utf8");
  }

  console.log(`\nwrote ${join(outDir, "intercom-raw.json")}`);
  console.log(`      ${articles.length} article files under ${join(outDir, "articles")}`);
  console.log(
    `\ncounts — help centres: ${helpCenters.length}, collections: ${collections.length}, articles: ${articles.length}`,
  );
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
