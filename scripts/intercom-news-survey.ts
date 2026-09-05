/**
 * Reports what Intercom's News holds against what the roadmap's changelog can
 * store, and how confidently the Arabic and English halves of each
 * announcement can be paired back together.
 *
 *   npm run intercom:news-survey
 *
 * Intercom writes one news item per language. `changelog_entries` is one row
 * carrying both, and both titles are NOT NULL — so nothing can be imported
 * until each Arabic item is matched to its English twin, and Intercom stores
 * no field linking them. This measures how far the evidence goes; it decides
 * nothing and writes nothing.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

interface NewsItem {
  id: string;
  /** Filled in by `intercom:news-images`: the downloaded cover on disk. */
  cover_image_file?: string | null;
  /** Nullable in practice: at least one item in this export has no title. */
  title: string | null;
  body: string | null;
  state: string;
  labels: string[];
  cover_image_url: string | null;
  /** The emoji Intercom offered readers, not a tally of what they picked. */
  reactions?: string[];
  created_at: number;
  published_at: number | null;
  newsfeed_assignments: { newsfeed_id: number; published_at: number | null }[];
}

const data = JSON.parse(readFileSync(join(root, "migration/intercom-export/intercom-news.json"), "utf8")) as {
  news_items: NewsItem[];
  newsfeeds: { id: string; name: string }[];
};

const ARABIC_FEED = 102840;
const ENGLISH_FEED = 102841;

type Language = "ar" | "en" | null;

/** The newsfeed an item was published to is the reliable signal; the `ar`/`en` label is not always set. */
function languageOf(item: NewsItem): Language {
  const feeds = new Set(item.newsfeed_assignments.map((a) => a.newsfeed_id));
  if (feeds.has(ARABIC_FEED)) return "ar";
  if (feeds.has(ENGLISH_FEED)) return "en";
  if (item.labels.includes("ar")) return "ar";
  if (item.labels.includes("en")) return "en";
  return null;
}

/** The unsigned part of a cover URL identifies the asset; the query string expires. */
/** A title safe to print and to compare; our own column is NOT NULL. */
const titleOf = (item: NewsItem): string => (item.title ?? "").trim();

const coverAsset = (item: NewsItem): string | null => (item.cover_image_url ?? "").split("?")[0] || null;

const items = data.news_items;
const arabic = items.filter((i) => languageOf(i) === "ar");
const english = items.filter((i) => languageOf(i) === "en");
const unknown = items.filter((i) => languageOf(i) === null);

// -- pairing ---------------------------------------------------------------

interface Pair {
  ar: NewsItem;
  en: NewsItem;
  /** "cover" is proof, "time" is inference, "read" is a human reading both titles. */
  evidence: "cover" | "time" | "read";
  secondsApart: number;
}

const pairs: Pair[] = [];
const taken = new Set<string>();

// 1. A shared cover image asset. Two items built from the same upload are the
//    same announcement. Proof, not inference.
const byCover = new Map<string, NewsItem[]>();
for (const item of items) {
  const asset = coverAsset(item);
  if (!asset) continue;
  byCover.set(asset, [...(byCover.get(asset) ?? []), item]);
}
for (const group of byCover.values()) {
  if (group.length !== 2) continue;
  const ar = group.find((i) => languageOf(i) === "ar");
  const en = group.find((i) => languageOf(i) === "en");
  if (!ar || !en || taken.has(ar.id) || taken.has(en.id)) continue;
  taken.add(ar.id);
  taken.add(en.id);
  pairs.push({ ar, en, evidence: "cover", secondsApart: ar.created_at - en.created_at });
}

// 2. Position and timing, constrained by the direction the proven pairs show.
//    In 30 of the 31 pairs above the Arabic item was created a few minutes
//    after its English twin and carries the higher id. Without that direction
//    the ids interleave (…ar, en, ar, en…) and a nearest-match rule pairs each
//    Arabic item with the English one on the wrong side — measured against the
//    proven pairs, that rule got 8 of 31 right. With it, 30 of 31.
const MIN_ID_GAP = 1;
const MAX_ID_GAP = 20;
const EARLIEST = -600; // the Arabic version may be a few minutes ahead
const LATEST = 7200;

const combos: { ar: NewsItem; en: NewsItem; idGap: number; seconds: number }[] = [];
for (const ar of items.filter((i) => languageOf(i) === "ar" && !taken.has(i.id))) {
  for (const en of items.filter((i) => languageOf(i) === "en" && !taken.has(i.id))) {
    const idGap = Number(ar.id) - Number(en.id);
    const seconds = ar.created_at - en.created_at;
    if (idGap < MIN_ID_GAP || idGap > MAX_ID_GAP) continue;
    if (seconds < EARLIEST || seconds > LATEST) continue;
    combos.push({ ar, en, idGap, seconds });
  }
}
// Closest in position first, then in time.
combos.sort((a, b) => a.idGap - b.idGap || Math.abs(a.seconds) - Math.abs(b.seconds));
for (const combo of combos) {
  if (taken.has(combo.ar.id) || taken.has(combo.en.id)) continue;
  taken.add(combo.ar.id);
  taken.add(combo.en.id);
  pairs.push({ ar: combo.ar, en: combo.en, evidence: "time", secondsApart: combo.seconds });
}

// 3. Two announcements whose halves were written hours apart, so no timing
//    rule reaches them. Paired by reading both titles, and listed in the
//    report so the reading can be checked rather than trusted.
const READ_AND_MATCHED: [string, string][] = [
  // Written five hours apart, so no timing rule reaches them.
  ["141829", "141812"], // كل أرقام واتساب في مكان واحد / Manage All Your WhatsApp Numbers in One Place
];
for (const [arId, enId] of READ_AND_MATCHED) {
  const ar = items.find((i) => i.id === arId);
  const en = items.find((i) => i.id === enId);
  if (!ar || !en || taken.has(ar.id) || taken.has(en.id)) continue;
  taken.add(ar.id);
  taken.add(en.id);
  pairs.push({ ar, en, evidence: "read", secondsApart: ar.created_at - en.created_at });
}

const unpaired = items.filter((i) => !taken.has(i.id));

// -- report ----------------------------------------------------------------

const out: string[] = [];
const line = (s = "") => {
  console.log(s);
  out.push(s);
};

line("# Intercom News — survey");
line();
line(`${items.length} news items across ${data.newsfeeds.length} newsfeeds.`);
line();
line("## Language");
line(`  Arabic feed (${ARABIC_FEED}):  ${arabic.length}`);
line(`  English feed (${ENGLISH_FEED}): ${english.length}`);
line(`  no feed assignment:      ${unknown.length}`);
for (const item of unknown) {
  line(`     ${item.id}  ${item.state.padEnd(5)}  labels=${JSON.stringify(item.labels)}  ${titleOf(item).slice(0, 48) || "(no title)"}`);
}
line();
line("## Pairing Arabic to English");
line(`  proven by a shared cover image: ${pairs.filter((p) => p.evidence === "cover").length}`);
line(`  inferred from position and time:${pairs.filter((p) => p.evidence === "time").length}`);
line(`  paired by reading both titles:  ${pairs.filter((p) => p.evidence === "read").length}`);
line(`  no counterpart at all:          ${unpaired.length}`);
line();
const provenGaps = pairs.filter((p) => p.evidence === "cover").map((p) => p.secondsApart).sort((a, b) => a - b);
if (provenGaps.length) {
  line(`  seconds between the English and Arabic version, on proven pairs: ${provenGaps[0]} to ${provenGaps.at(-1)}`);
}
line();
line("  every proposed pair, for checking:");
for (const p of [...pairs].sort((a, b) => b.ar.created_at - a.ar.created_at)) {
  line(`     [${p.evidence.padEnd(5)}] AR ${p.ar.id} ${titleOf(p.ar).slice(0, 46)}`);
  line(`               EN ${p.en.id} ${titleOf(p.en).slice(0, 46)}`);
}
line();
if (unpaired.length) {
  line("  with no counterpart:");
  for (const item of unpaired.sort((a, b) => Number(a.id) - Number(b.id))) {
    line(`     ${languageOf(item) ?? "??"}  ${item.id}  ${item.state.padEnd(5)}  ${titleOf(item).slice(0, 52) || "(no title)"}`);
  }
  line();
}

const untitled = items.filter((i) => !titleOf(i));
const emptyBody = items.filter((i) => !(i.body ?? "").trim());
line("## Rows our schema would refuse");
line(`  no title (title_ar / title_en are NOT NULL): ${untitled.length}`);
for (const item of untitled) line(`     ${item.id}  ${item.state}  ${languageOf(item) ?? "??"}`);
line(`  empty body: ${emptyBody.length}`);
line();

line("## What the body contains, and what our changelog can render");
const tags = new Map<string, number>();
for (const item of items) {
  for (const match of (item.body ?? "").matchAll(/<([a-zA-Z0-9]+)/g)) {
    const tag = match[1].toLowerCase();
    tags.set(tag, (tags.get(tag) ?? 0) + 1);
  }
}
const RENDERABLE = new Set(["p", "div", "br"]);
for (const [tag, count] of [...tags].sort((a, b) => b[1] - a[1])) {
  line(`  <${tag}> ×${count}${RENDERABLE.has(tag) ? "" : "   NOT RENDERED — the changelog body is plain text in paragraphs"}`);
}
line();

line("## Kind");
const labelCounts = new Map<string, number>();
for (const item of items) {
  const kinds = item.labels.filter((l) => l !== "ar" && l !== "en");
  const key = kinds.length ? kinds.join(" + ") : "(no label)";
  labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
}
for (const [label, count] of [...labelCounts].sort((a, b) => b[1] - a[1])) {
  line(`  ${String(count).padStart(4)}  ${label}`);
}
line("  our enum is: new | improved | fixed");
line();

line("## Other fields");
line(`  state: ${items.filter((i) => i.state === "live").length} live, ${items.filter((i) => i.state !== "live").length} draft`);
line(`  cover image: ${items.filter((i) => i.cover_image_url).length} have one, ${items.filter((i) => !i.cover_image_url).length} do not`);
line("  cover alt text: Intercom stores none; our schema has image_alt_ar / image_alt_en");
line(`  reactions offered by Intercom: ${[...new Set(items.flatMap((i) => i.reactions ?? []))].join(" ")}`);
line("  reactions our schema allows:   🎉 🔥 💯 👏 ❤️");
line("  (the field is the offered set, not a tally — there are no reaction counts to carry)");
line("  sender / author: no equivalent, and the user already chose not to add one");
line("  deliver_silently, newsfeed assignment: no equivalent");

line();
line("## How much of the body our changelog cannot show");
const needs = (body: string | null, re: RegExp) => re.test(body ?? "");
const titled = items.filter((i) => titleOf(i));
const counts = {
  list: titled.filter((i) => needs(i.body, /<(ul|ol)\b/i)).length,
  bold: titled.filter((i) => needs(i.body, /<(b|strong)\b/i)).length,
  link: titled.filter((i) => needs(i.body, /<a\b/i)).length,
  heading: titled.filter((i) => needs(i.body, /<h[1-6]\b/i)).length,
};
const anyRich = titled.filter(
  (i) => needs(i.body, /<(ul|ol|b|strong|a|h[1-6])\b/i),
).length;
line(`  of ${titled.length} titled items:`);
line(`    a bulleted list : ${counts.list}`);
line(`    bold text       : ${counts.bold}`);
line(`    a link          : ${counts.link}`);
line(`    a heading       : ${counts.heading}`);
line(`  need more than plain paragraphs: ${anyRich} (${Math.round((anyRich / titled.length) * 100)}%)`);
line();
const hosts = new Map<string, number>();
for (const item of titled) {
  for (const match of (item.body ?? "").matchAll(/<a[^>]*href="([^"]+)"/g)) {
    try {
      const host = new URL(match[1]).hostname;
      hosts.set(host, (hosts.get(host) ?? 0) + 1);
    } catch {
      /* a relative or malformed href; nothing to count */
    }
  }
}
line("  hosts linked from news bodies:");
for (const [host, count] of [...hosts].sort((a, b) => b[1] - a[1])) {
  line(`    ${String(count).padStart(4)}  ${host}${host === "help.flovoo.com" ? "   (would need rewriting, as the articles did)" : ""}`);
}
line();
line("## Cover images");
const saved = items.filter((i) => i.cover_image_file).length;
const noCover = items.filter((i) => !i.cover_image_url).length;
const lost = items.filter((i) => i.cover_image_url && !i.cover_image_file);
line(`  downloaded: ${saved}`);
line(`  no cover at all: ${noCover}`);
line(`  could not be downloaded: ${lost.length}`);
for (const item of lost) line(`     ${item.id} ${item.state} — Intercom returned 410 Gone; the file is deleted on their side`);
line(`  distinct cover files: ${new Set(items.map((i) => i.cover_image_file).filter(Boolean)).size}`);

writeFileSync(join(root, "migration", "news-survey.md"), out.join("\n"), "utf8");
console.log(`\nwrote ${join(root, "migration", "news-survey.md")}`);
