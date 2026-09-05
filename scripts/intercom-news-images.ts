/**
 * Re-fetches Intercom's News and downloads every cover image.
 *
 *   npm run intercom:news-images
 *
 * Cover URLs are signed and short-lived — the ones in the first export were
 * dead within a day, which is why this re-fetches the list rather than reading
 * the file on disk. The freshly signed URLs are written back to
 * `intercom-news.json` alongside the local filename, so nothing downstream
 * depends on Intercom staying reachable.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const exportDir = join(root, "migration", "intercom-export");
const imageDir = join(exportDir, "news-images");

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

async function api<T>(path: string): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(`https://api.intercom.io${path}`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "Intercom-Version": "2.11",
      },
      signal: AbortSignal.timeout(45000),
    });
    if (response.status === 429) {
      const wait = Number(response.headers.get("x-ratelimit-reset")) || 10;
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (!response.ok) throw new Error(`${response.status} on ${path}`);
    return (await response.json()) as T;
  }
  throw new Error(`gave up on ${path}`);
}

interface NewsItem {
  id: string;
  cover_image_url?: string | null;
  /** Added here: the downloaded file, so the import never needs Intercom. */
  cover_image_file?: string | null;
  [key: string]: unknown;
}

const EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/**
 * One image, with retries.
 *
 * `downloads.intercomcdn.com` resolves to two addresses and one of them was
 * refusing connections while this ran; Node picks an address per attempt, so a
 * retry is usually a different one. Giving up on the first connect timeout
 * would have lost every cover on the workspace.
 */
async function download(url: string): Promise<{ body: Uint8Array; contentType: string }> {
  let lastError = "";
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = new Uint8Array(await response.arrayBuffer());
      if (body.byteLength === 0) throw new Error("empty response");
      return { body, contentType: (response.headers.get("content-type") ?? "").split(";")[0].trim() };
    } catch (error) {
      lastError = (error as Error).message;
      await new Promise((r) => setTimeout(r, Math.min(500 * attempt, 3000)));
    }
  }
  throw new Error(`${lastError} (6 attempts)`);
}

async function main() {
  // `/news/news_items` caps per_page at 20 and pages by number, with no next link.
  const items: NewsItem[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await api<{ data?: NewsItem[]; pages?: { total_pages?: number }; total_count?: number }>(
      `/news/news_items?per_page=20&page=${page}`,
    );
    items.push(...(response.data ?? []));
    totalPages = response.pages?.total_pages ?? 1;
    process.stdout.write(`\r  news items: ${items.length}   `);
    page++;
  } while (page <= totalPages);
  process.stdout.write("\n");

  const newsfeeds = (await api<{ data?: unknown[] }>("/news/newsfeeds")).data ?? [];

  mkdirSync(imageDir, { recursive: true });
  const withCover = items.filter((i) => i.cover_image_url);
  console.log(`${withCover.length} of ${items.length} items have a cover image`);

  let downloaded = 0;
  let failed = 0;
  let bytes = 0;
  const failures: string[] = [];

  for (const item of items) {
    const url = item.cover_image_url;
    if (!url) {
      item.cover_image_file = null;
      continue;
    }
    // Name by the asset path, not the signed URL: the signature changes on
    // every fetch and would otherwise re-download the same picture forever.
    const key = createHash("sha256").update(url.split("?")[0]).digest("hex").slice(0, 32);
    try {
      const { body, contentType } = await download(url);
      const extension = EXTENSION[contentType] ?? url.split("?")[0].split(".").pop()?.toLowerCase() ?? "bin";
      const file = `${key}.${extension}`;
      writeFileSync(join(imageDir, file), body);
      item.cover_image_file = file;
      bytes += body.byteLength;
      downloaded++;
    } catch (error) {
      item.cover_image_file = null;
      failed++;
      failures.push(`${item.id}: ${(error as Error).message}`);
    }
    process.stdout.write(`\r  covers: ${downloaded} saved, ${failed} failed   `);
  }
  process.stdout.write("\n");

  writeFileSync(
    join(exportDir, "intercom-news.json"),
    JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        counts: { news_items: items.length, newsfeeds: newsfeeds.length },
        news_items: items,
        newsfeeds,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`\nsaved ${downloaded} covers (${(bytes / 1024 / 1024).toFixed(1)} MB) to ${imageDir}`);
  console.log(`refreshed ${join(exportDir, "intercom-news.json")}`);
  if (failed) {
    console.log(`\nFAILED (${failed}):`);
    for (const failure of failures) console.log(`  ${failure}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
