/**
 * Reads the raw export and reports what is actually in it, then measures every
 * piece against what our content model can represent.
 *
 *   npm run intercom:survey
 *
 * Reports, never decides. Anything with no equivalent on our side is listed so
 * the user can choose: extend the model, carry it differently, or drop it
 * knowingly. Writes `migration/survey.md` alongside the console output.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const exportPath = join(root, "migration", "intercom-export", "intercom-raw.json");

if (!existsSync(exportPath)) {
  console.error("Run `npm run intercom:export` first.");
  process.exit(1);
}

interface IntercomTranslation {
  title?: string;
  description?: string;
  body?: string;
  author_id?: number;
  state?: string;
  created_at?: number;
  updated_at?: number;
  url?: string;
}

/** `translated_content` carries a `type` discriminator beside the locales. */
const NOT_A_LOCALE = new Set(["type"]);
const localesOf = (translated: Record<string, unknown> | null | undefined): string[] =>
  Object.keys(translated ?? {}).filter((key) => !NOT_A_LOCALE.has(key) && translated?.[key]);

/** The collection link lives in `parent_ids`; `parent_id` is null on every row. */
const collectionIdOf = (article: { parent_ids?: (number | string)[] }): string | null =>
  article.parent_ids?.length ? String(article.parent_ids[0]) : null;

interface IntercomArticle {
  id: string;
  title?: string;
  description?: string;
  body?: string;
  author_id?: number;
  state?: string;
  created_at?: number;
  updated_at?: number;
  url?: string;
  parent_id?: number | string | null;
  parent_type?: string | null;
  parent_ids?: (number | string)[];
  default_locale?: string;
  translated_content?: Record<string, IntercomTranslation | null> | null;
  [key: string]: unknown;
}

interface IntercomCollection {
  id: string;
  name?: string;
  description?: string;
  url?: string;
  icon?: string;
  order?: number;
  parent_id?: number | string | null;
  help_center_id?: number | string;
  default_locale?: string;
  translated_content?: Record<string, { name?: string; description?: string } | null> | null;
  [key: string]: unknown;
}

const raw = JSON.parse(readFileSync(exportPath, "utf8")) as {
  workspace: { name?: string } | null;
  help_centers: Record<string, unknown>[];
  collections: IntercomCollection[];
  articles: IntercomArticle[];
  admins: { id?: string | number; name?: string }[];
};

// ---------------------------------------------------------------------------
// What our block format can represent
// ---------------------------------------------------------------------------

/** HTML tags our importer can carry into the block model without loss. */
const SUPPORTED_TAGS = new Set([
  "p", "br", "h2", "h3", "ul", "ol", "li", "b", "strong", "i", "em", "u", "s",
  "del", "code", "pre", "a", "img", "table", "thead", "tbody", "tr", "th", "td",
  "blockquote", "hr", "div", "span", "figure", "figcaption",
]);

/** Tags we can carry only by changing them — the user should know. */
const DEGRADED_TAGS: Record<string, string> = {
  h1: "becomes a level-2 heading (the page title is already the h1)",
  h4: "becomes a level-3 heading",
  h5: "becomes a level-3 heading",
  h6: "becomes a level-3 heading",
  iframe: "kept only for YouTube/Vimeo; any other embed has no equivalent",
  video: "no equivalent block — only YouTube/Vimeo embeds are supported",
  audio: "no equivalent block",
  button: "no equivalent block",
  form: "no equivalent block",
  input: "no equivalent block",
  select: "no equivalent block",
  script: "never carried across",
  style: "never carried across",
};

const lines: string[] = [];
const say = (text = "") => {
  console.log(text);
  lines.push(text);
};

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

say(`# Intercom survey — ${raw.workspace?.name ?? "workspace"}`);
say();
say(`Exported ${raw.articles.length} articles, ${raw.collections.length} collections, ${raw.help_centers.length} help centre(s).`);
say();

say("## Collections");
say();
const byId = new Map(raw.collections.map((c) => [String(c.id), c]));
const depthOf = (collection: IntercomCollection): number => {
  let depth = 0;
  let current: IntercomCollection | undefined = collection;
  const seen = new Set<string>();
  while (current?.parent_id != null && !seen.has(String(current.id))) {
    seen.add(String(current.id));
    current = byId.get(String(current.parent_id));
    depth++;
  }
  return depth;
};
const depths = new Map<number, number>();
for (const collection of raw.collections) {
  const depth = depthOf(collection);
  depths.set(depth, (depths.get(depth) ?? 0) + 1);
}
say(`Nesting depth: ${[...depths.entries()].sort().map(([d, n]) => `${n} at depth ${d}`).join(", ")}`);
say();
for (const collection of raw.collections.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
  const depth = depthOf(collection);
  const count = raw.articles.filter((a) => collectionIdOf(a) === String(collection.id)).length;
  const locales = localesOf(collection.translated_content as Record<string, unknown>);
  say(
    `${"  ".repeat(depth)}- ${collection.name} — id ${collection.id}, ${count} article(s)` +
      `${collection.icon ? `, icon "${collection.icon}"` : ", no icon"}` +
      `${locales.length ? `, translations: ${locales.join("/")}` : ", no translations"}`,
  );
}
say();

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

say("## Articles");
say();
const states = new Map<string, number>();
const localeCounts = new Map<string, number>();
const orphans: IntercomArticle[] = [];
const multiParent: IntercomArticle[] = [];
const noBody: IntercomArticle[] = [];
let translatedArticles = 0;

for (const article of raw.articles) {
  states.set(article.state ?? "unknown", (states.get(article.state ?? "unknown") ?? 0) + 1);
  const translations = article.translated_content ?? {};
  const locales = localesOf(translations as Record<string, unknown>);
  if (locales.length > 1) translatedArticles++;
  for (const locale of locales.length ? locales : [article.default_locale ?? "?"]) {
    localeCounts.set(locale, (localeCounts.get(locale) ?? 0) + 1);
  }
  const collectionId = collectionIdOf(article);
  if (!collectionId || !byId.has(collectionId)) orphans.push(article);
  if ((article.parent_ids?.length ?? 0) > 1) multiParent.push(article);
  const anyBody =
    (article.body ?? "").trim() ||
    locales.some((l) => ((translations[l] as IntercomTranslation | null)?.body ?? "").trim());
  if (!anyBody) noBody.push(article);
}

say(`States: ${[...states.entries()].map(([s, n]) => `${s} ${n}`).join(", ")}`);
say(`Locales present: ${[...localeCounts.entries()].map(([l, n]) => `${l} ${n}`).join(", ")}`);
say(`Articles with more than one language: ${translatedArticles}`);
say(`Articles with no collection: ${orphans.length}`);
if (orphans.length) for (const a of orphans) say(`  - ${a.id} "${a.title}" (${a.state})`);
say(`Articles filed under more than one collection: ${multiParent.length}`);
if (multiParent.length) for (const a of multiParent) say(`  - ${a.id} "${a.title}" → ${a.parent_ids?.join(", ")}`);
say(`Articles with an empty body in every language: ${noBody.length}`);
if (noBody.length) for (const a of noBody) say(`  - ${a.id} "${a.title}" (${a.state})`);
say();

// Per-locale state, since Intercom can publish one language and not the other.
const localeStates = new Map<string, Map<string, number>>();
for (const article of raw.articles) {
  const translations = article.translated_content ?? {};
  for (const [locale, translation] of Object.entries(translations)) {
    if (!translation || NOT_A_LOCALE.has(locale)) continue;
    const map = localeStates.get(locale) ?? new Map<string, number>();
    const state = translation.state ?? article.state ?? "unknown";
    map.set(state, (map.get(state) ?? 0) + 1);
    localeStates.set(locale, map);
  }
}
if (localeStates.size) {
  say("State per language (Intercom can publish one language and not the other):");
  for (const [locale, map] of localeStates) {
    say(`  ${locale}: ${[...map.entries()].map(([s, n]) => `${s} ${n}`).join(", ")}`);
  }
  say();
}

// ---------------------------------------------------------------------------
// Body HTML
// ---------------------------------------------------------------------------

say("## What the article bodies contain");
say();
const tagCounts = new Map<string, number>();
const tagExamples = new Map<string, string>();
const imageHosts = new Map<string, number>();
const iframeHosts = new Map<string, number>();
const linkHosts = new Map<string, number>();
let imageCount = 0;
const nestedLists: string[] = [];
const tablesWithSpans: string[] = [];
const anchorsInside: string[] = [];

function bodies(article: IntercomArticle): { locale: string; html: string }[] {
  const out: { locale: string; html: string }[] = [];
  const translations = article.translated_content ?? {};
  const localeKeys = localesOf(translations as Record<string, unknown>).filter((k) => translations[k]?.body);
  if (localeKeys.length) {
    for (const locale of localeKeys) out.push({ locale, html: translations[locale]!.body! });
  } else if (article.body) {
    out.push({ locale: article.default_locale ?? "?", html: article.body });
  }
  return out;
}

for (const article of raw.articles) {
  for (const { html } of bodies(article)) {
    for (const match of html.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g)) {
      const tag = match[1].toLowerCase();
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      if (!tagExamples.has(tag)) {
        tagExamples.set(tag, `${article.id} "${(article.title ?? "").slice(0, 40)}"`);
      }
      const attrs = match[2];
      if (tag === "img") {
        imageCount++;
        const src = attrs.match(/src=["']([^"']+)["']/)?.[1];
        if (src) {
          try {
            imageHosts.set(new URL(src).hostname, (imageHosts.get(new URL(src).hostname) ?? 0) + 1);
          } catch {
            imageHosts.set("(relative or malformed)", (imageHosts.get("(relative or malformed)") ?? 0) + 1);
          }
        }
      }
      if (tag === "iframe") {
        const src = attrs.match(/src=["']([^"']+)["']/)?.[1];
        try {
          if (src) iframeHosts.set(new URL(src).hostname, (iframeHosts.get(new URL(src).hostname) ?? 0) + 1);
        } catch {
          iframeHosts.set("(malformed)", (iframeHosts.get("(malformed)") ?? 0) + 1);
        }
      }
      if (tag === "a") {
        const href = attrs.match(/href=["']([^"']+)["']/)?.[1];
        if (href?.startsWith("#")) anchorsInside.push(article.id);
        try {
          if (href && !href.startsWith("#")) {
            const host = new URL(href, "https://example.com").hostname;
            linkHosts.set(host, (linkHosts.get(host) ?? 0) + 1);
          }
        } catch {
          /* ignore */
        }
      }
    }
    if (/<li[^>]*>(?:(?!<\/li>)[\s\S])*<(?:ul|ol)\b/i.test(html)) nestedLists.push(article.id);
    if (/<t[dh][^>]*(?:colspan|rowspan)=/i.test(html)) tablesWithSpans.push(article.id);
  }
}

say("Tags used, most common first:");
for (const [tag, count] of [...tagCounts.entries()].sort((a, b) => b[1] - a[1])) {
  const status = SUPPORTED_TAGS.has(tag)
    ? "carried as-is"
    : DEGRADED_TAGS[tag]
      ? `NEEDS A DECISION — ${DEGRADED_TAGS[tag]}`
      : "NEEDS A DECISION — unknown tag, no mapping";
  say(`  <${tag}> ×${count} — ${status}${SUPPORTED_TAGS.has(tag) ? "" : ` (first seen: ${tagExamples.get(tag)})`}`);
}
say();
say(`Images: ${imageCount} across ${[...imageHosts.keys()].length} host(s)`);
for (const [host, count] of imageHosts) say(`  ${host}: ${count}`);
say();
if (iframeHosts.size) {
  say("Embeds (iframes):");
  for (const [host, count] of iframeHosts) {
    const known = /youtube|youtu\.be|vimeo/i.test(host);
    say(`  ${host}: ${count} — ${known ? "supported" : "NEEDS A DECISION — no equivalent block"}`);
  }
  say();
}
say(`Nested lists (a list inside a list item): ${new Set(nestedLists).size} article(s)${nestedLists.length ? ` — ${[...new Set(nestedLists)].join(", ")}` : ""}`);
say(`Tables using colspan/rowspan: ${new Set(tablesWithSpans).size} article(s)${tablesWithSpans.length ? ` — ${[...new Set(tablesWithSpans)].join(", ")}` : ""}`);
say(`In-page anchor links (#…): ${new Set(anchorsInside).size} article(s)`);
say();
say("Most linked hosts (internal links become redirect candidates):");
for (const [host, count] of [...linkHosts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  say(`  ${host}: ${count}`);
}
say();

// ---------------------------------------------------------------------------
// Fields Intercom has that we may not
// ---------------------------------------------------------------------------

say("## Body formats available");
say();
let withHtml = 0;
let withMarkdown = 0;
for (const article of raw.articles) {
  const translations = (article.translated_content ?? {}) as Record<string, IntercomTranslation & { body_markdown?: string }>;
  for (const locale of localesOf(translations as Record<string, unknown>)) {
    if ((translations[locale]?.body ?? "").trim()) withHtml++;
    if ((translations[locale]?.body_markdown ?? "").trim()) withMarkdown++;
  }
}
say(`Language versions with HTML body: ${withHtml}`);
say(`Language versions with a Markdown body as well: ${withMarkdown}`);
say("HTML is the conversion source — it carries tables, images and structure precisely.");
say();

say("## Fields on the Intercom objects");
say();
const articleKeys = new Map<string, number>();
for (const article of raw.articles) {
  for (const [key, value] of Object.entries(article)) {
    if (value === null || value === undefined || value === "") continue;
    articleKeys.set(key, (articleKeys.get(key) ?? 0) + 1);
  }
}
const OUR_ARTICLE_FIELDS: Record<string, string> = {
  id: "kept as the redirect key, not as our id",
  title: "→ title",
  description: "→ excerpt",
  body: "→ body (converted to blocks)",
  state: "→ status (but everything imports as draft)",
  parent_id: "→ collection",
  parent_type: "used to read the hierarchy",
  parent_ids: "used to read the hierarchy",
  default_locale: "decides which language is primary",
  translated_content: "→ the per-language rows",
  url: "→ the redirect source",
  created_at: "informational",
  updated_at: "informational",
  workspace_id: "not needed",
  type: "not needed",
  statistics: "NEEDS A DECISION — Intercom's own view/reaction counts",
  author_id: "NEEDS A DECISION — we do not store an author",
  content_id: "an internal Intercom id; nothing to carry",
  body_markdown: "Intercom's own Markdown twin of the body; HTML is the source we use",
};
for (const [key, count] of [...articleKeys.entries()].sort()) {
  const note = OUR_ARTICLE_FIELDS[key] ?? "NEEDS A DECISION — no field on our side";
  say(`  ${key} (on ${count}/${raw.articles.length}) — ${note}`);
}
say();

const collectionKeys = new Map<string, number>();
for (const collection of raw.collections) {
  for (const [key, value] of Object.entries(collection)) {
    if (value === null || value === undefined || value === "") continue;
    collectionKeys.set(key, (collectionKeys.get(key) ?? 0) + 1);
  }
}
const OUR_COLLECTION_FIELDS: Record<string, string> = {
  id: "used to map articles to topics",
  name: "→ name",
  description: "→ description",
  icon: "→ icon (mapped to the Lucide allow-list)",
  order: "→ sort_order",
  url: "→ the redirect source",
  parent_id: "NEEDS A DECISION if any collection is nested",
  translated_content: "→ the per-language name and description",
  default_locale: "decides which language is primary",
  help_center_id: "only matters with more than one help centre",
  created_at: "informational",
  updated_at: "informational",
  workspace_id: "not needed",
  type: "not needed",
};
say("Collection fields:");
for (const [key, count] of [...collectionKeys.entries()].sort()) {
  say(`  ${key} (on ${count}/${raw.collections.length}) — ${OUR_COLLECTION_FIELDS[key] ?? "NEEDS A DECISION — no field on our side"}`);
}
say();

mkdirSync(join(root, "migration"), { recursive: true });
writeFileSync(join(root, "migration", "survey.md"), lines.join("\n"), "utf8");
console.log(`\nwrote ${join(root, "migration", "survey.md")}`);
