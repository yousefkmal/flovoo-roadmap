/**
 * Backs up the customer data that disappears when the Intercom account closes:
 * conversations with their full message threads, contacts, companies, tags and
 * segments.
 *
 *   npm run intercom:private-backup
 *
 * Writes to `migration/private-backup/`, which is in `.gitignore`. This is
 * personal information: it stays on this machine, never reaches the repository
 * and never enters the database. Nothing else in the app reads it.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const outDir = join(root, "migration", "private-backup");

function loadToken(): string {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    if (trimmed.slice(0, eq).trim() === "INTERCOM_ACCESS_TOKEN") return trimmed.slice(eq + 1).trim();
  }
  throw new Error("INTERCOM_ACCESS_TOKEN is not set in .env.local");
}

const token = loadToken();

async function api<T = Record<string, unknown>>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `https://api.intercom.io${path}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "Intercom-Version": "2.11",
      },
      signal: AbortSignal.timeout(45000),
    });
    if (response.status === 429) {
      const wait = Number(response.headers.get("x-ratelimit-reset")) || 10;
      process.stdout.write(` [rate limited, ${wait}s] `);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (!response.ok) throw new Error(`${response.status} on ${path}`);
    return (await response.json()) as T;
  }
  throw new Error(`gave up on ${path}`);
}

interface Page {
  // Newer list endpoints return `data`; `/conversations` still returns its rows
  // under the type name, and reads as an empty page if you only look at `data`.
  data?: Record<string, unknown>[];
  conversations?: Record<string, unknown>[];
  contacts?: Record<string, unknown>[];
  companies?: Record<string, unknown>[];
  total_count?: number;
  pages?: {
    next?: string | { starting_after?: string };
    page?: number;
    per_page?: number;
    total_pages?: number;
  };
}

/**
 * Walks a list endpoint through either pagination style Intercom uses: a
 * cursor (`pages.next`) or a page number.
 *
 * It stops on the first page that adds nothing new, and de-duplicates by id.
 * `/contacts` handed back a cursor that restarted the list from the beginning
 * once the last page was reached, so trusting `pages.next` alone walked the
 * same 419 contacts round and round.
 */
async function all(
  path: string,
  label: string,
  perPage: number,
  expected?: number,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  const separator = path.includes("?") ? "&" : "?";
  let url: string | null = `${path}${separator}per_page=${perPage}`;
  let pageNumber = 1;
  let totalPages = 1;
  let totalCount: number | undefined = expected;

  while (url) {
    const page: Page = await api<Page>(url);
    const batch = page.data ?? page.conversations ?? page.contacts ?? page.companies ?? [];
    totalPages = page.pages?.total_pages ?? totalPages;
    totalCount = page.total_count ?? totalCount;

    let added = 0;
    for (const row of batch) {
      const id = String(row.id ?? JSON.stringify(row));
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(row);
      added++;
    }
    process.stdout.write(`\r  ${label}: ${rows.length}${totalCount ? ` / ${totalCount}` : ""}   `);

    // A page that repeats what we already have means the cursor wrapped.
    if (added === 0) break;
    if (totalCount !== undefined && rows.length >= totalCount) break;

    const next = page.pages?.next;
    if (typeof next === "string" && next) url = next;
    else if (next && typeof next === "object" && next.starting_after) {
      url = `${path}${separator}per_page=${perPage}&starting_after=${next.starting_after}`;
    } else if (pageNumber < totalPages) {
      pageNumber++;
      url = `${path}${separator}per_page=${perPage}&page=${pageNumber}`;
    } else url = null;
  }
  process.stdout.write("\n");
  if (totalCount !== undefined && rows.length !== totalCount) {
    console.log(`     NOTE: ${label} returned ${rows.length} rows but Intercom reports ${totalCount}`);
  }
  return rows;
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  console.log("Backing up customer data (stays on this machine, never in git):\n");

  const contacts = await all("/contacts", "contacts", 150);
  writeFileSync(join(outDir, "contacts.json"), JSON.stringify(contacts, null, 2), "utf8");

  const companies = await all("/companies", "companies", 50);
  writeFileSync(join(outDir, "companies.json"), JSON.stringify(companies, null, 2), "utf8");

  const tags = (await api<{ data?: unknown[] }>("/tags")).data ?? [];
  writeFileSync(join(outDir, "tags.json"), JSON.stringify(tags, null, 2), "utf8");
  console.log(`  tags: ${tags.length}`);

  const attributes = (await api<{ data?: unknown[] }>("/data_attributes")).data ?? [];
  writeFileSync(join(outDir, "data-attributes.json"), JSON.stringify(attributes, null, 2), "utf8");
  console.log(`  data attributes: ${attributes.length}`);

  // The list endpoint returns conversation summaries; the full message thread
  // only comes from the single-conversation endpoint, and the thread is the
  // part worth keeping.
  const summaries = await all("/conversations", "conversations (list)", 150);
  mkdirSync(join(outDir, "conversations"), { recursive: true });
  let fetched = 0;
  let failed = 0;
  const failures: string[] = [];
  for (const summary of summaries) {
    const id = String(summary.id);
    try {
      const full = await api(`/conversations/${id}`);
      writeFileSync(join(outDir, "conversations", `${id}.json`), JSON.stringify(full, null, 2), "utf8");
      fetched++;
    } catch (error) {
      failed++;
      failures.push(`${id}: ${(error as Error).message}`);
    }
    process.stdout.write(`\r  conversations (threads): ${fetched} saved, ${failed} failed   `);
  }
  process.stdout.write("\n");

  const manifest = {
    backed_up_at: new Date().toISOString(),
    counts: {
      contacts: contacts.length,
      companies: companies.length,
      tags: tags.length,
      data_attributes: attributes.length,
      conversations_listed: summaries.length,
      conversation_threads_saved: fetched,
      conversation_threads_failed: failed,
    },
    failures,
  };
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  console.log(`\nwrote ${outDir}`);
  console.log(JSON.stringify(manifest.counts, null, 2));
  if (failed > 0) {
    console.log("\nfailed threads:");
    for (const line of failures) console.log(`  ${line}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
