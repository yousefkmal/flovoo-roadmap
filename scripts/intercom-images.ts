/**
 * Downloads every image referenced by an exported Intercom article body into
 * `migration/intercom-export/images/`, with a manifest mapping the original
 * URL to the local file.
 *
 *   npm run intercom:images
 *
 * Runs as part of the safety net, before any import. Intercom serves article
 * images from signed URLs that expire — the ones in this export expire within
 * days — so the bytes have to come down while the export is fresh. After this,
 * the import reads local files and never depends on Intercom being reachable.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const exportDir = join(root, "migration", "intercom-export");
const imageDir = join(exportDir, "images");
const manifestPath = join(exportDir, "images.json");

if (!existsSync(join(exportDir, "intercom-raw.json"))) {
  console.error("Run `npm run intercom:export` first.");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(join(exportDir, "intercom-raw.json"), "utf8")) as {
  articles: {
    id: string;
    title?: string;
    translated_content?: Record<string, { body?: string } | null> | null;
  }[];
};

/** Bodies are HTML, so `&amp;` in a URL is an escaped `&`. */
function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

interface ManifestEntry {
  url: string;
  file: string | null;
  bytes: number;
  contentType: string | null;
  articles: string[];
  /** Alt text as it appeared in Intercom, if any. */
  alt: string | null;
  error?: string;
}

async function main() {
  // One entry per distinct URL, remembering every article that uses it.
  const found = new Map<string, ManifestEntry>();

  for (const article of raw.articles) {
    for (const [locale, translation] of Object.entries(article.translated_content ?? {})) {
      if (locale === "type" || !translation?.body) continue;
      for (const match of translation.body.matchAll(/<img\b([^>]*)>/gi)) {
        const attrs = match[1];
        const src = attrs.match(/\bsrc=["']([^"']+)["']/i)?.[1];
        if (!src) continue;
        const url = decodeEntities(src);
        const alt = attrs.match(/\balt=["']([^"']*)["']/i)?.[1] ?? null;
        const entry = found.get(url) ?? {
          url,
          file: null,
          bytes: 0,
          contentType: null,
          articles: [],
          alt: alt?.trim() || null,
        };
        if (!entry.articles.includes(article.id)) entry.articles.push(article.id);
        if (!entry.alt && alt?.trim()) entry.alt = alt.trim();
        found.set(url, entry);
      }
    }
  }

  console.log(`${found.size} distinct images referenced by ${raw.articles.length} articles`);
  mkdirSync(imageDir, { recursive: true });

  let downloaded = 0;
  let failed = 0;
  let totalBytes = 0;
  const entries = [...found.values()];

  for (const [index, entry] of entries.entries()) {
    // The URL is the identity; the hash keeps names short and stable.
    const key = createHash("sha256").update(entry.url).digest("hex").slice(0, 32);
    try {
      const response = await fetch(entry.url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength === 0) throw new Error("empty response");

      const extension =
        EXTENSIONS[contentType] ??
        entry.url.split("?")[0].split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ??
        "bin";
      const file = `${key}.${extension}`;
      writeFileSync(join(imageDir, file), bytes);
      entry.file = file;
      entry.bytes = bytes.byteLength;
      entry.contentType = contentType || null;
      totalBytes += bytes.byteLength;
      downloaded++;
    } catch (error) {
      entry.error = (error as Error).message;
      failed++;
    }
    process.stdout.write(`\r  downloaded ${downloaded}, failed ${failed} — ${index + 1}/${entries.length}   `);
  }
  process.stdout.write("\n");

  writeFileSync(manifestPath, JSON.stringify({ downloaded_at: new Date().toISOString(), images: entries }, null, 2), "utf8");

  const withAlt = entries.filter((e) => e.alt).length;
  console.log(`\nsaved ${downloaded} files (${(totalBytes / 1024 / 1024).toFixed(1)} MB) to ${imageDir}`);
  console.log(`manifest: ${manifestPath}`);
  console.log(`images carrying alt text in Intercom: ${withAlt} of ${entries.length}`);
  if (failed > 0) {
    console.log(`\nFAILED (${failed}):`);
    for (const entry of entries.filter((e) => e.error)) {
      console.log(`  ${entry.error} — used by ${entry.articles.join(", ")}`);
      console.log(`    ${entry.url.slice(0, 120)}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
