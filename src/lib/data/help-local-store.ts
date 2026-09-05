import "server-only";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  HELP_ARTICLES,
  HELP_COLLECTIONS,
  HELP_TRANSLATIONS,
} from "@/lib/data/help-seed";
import type {
  HelpArticle,
  HelpArticleTranslation,
  HelpCollection,
  HelpMedia,
  HelpRedirect,
} from "@/lib/help/types";
import type { Locale } from "@/lib/types";

/**
 * Help-center state for local development, when Supabase is not configured.
 * Process memory, on purpose — the same trade `local-store.ts` makes for the
 * roadmap: the whole flow is exercisable with no setup, and it is obvious that
 * it resets with the server.
 *
 * Content edits are kept as overrides layered over the frozen seed, and
 * `localHelpContent()` is the ONE place that merges them. The public repository
 * and the admin repository both read through it, so they can never disagree
 * about which articles exist — the bug the roadmap paid for once.
 */

// ---------------------------------------------------------------------------
// Content overrides
// ---------------------------------------------------------------------------

const collections = new Map<string, HelpCollection>();
const deletedCollections = new Set<string>();
const articles = new Map<string, HelpArticle>();
const translations = new Map<string, HelpArticleTranslation>();
const deletedTranslations = new Set<string>();

export interface LocalHelpContent {
  collections: HelpCollection[];
  articles: HelpArticle[];
  translations: HelpArticleTranslation[];
}

/** Seed plus every local edit, in one consistent snapshot. */
export function localHelpContent(): LocalHelpContent {
  const mergedCollections = new Map(HELP_COLLECTIONS.map((c) => [c.id, c]));
  for (const [id, c] of collections) mergedCollections.set(id, c);
  for (const id of deletedCollections) mergedCollections.delete(id);

  const mergedArticles = new Map(HELP_ARTICLES.map((a) => [a.id, a]));
  for (const [id, a] of articles) mergedArticles.set(id, a);

  const mergedTranslations = new Map(HELP_TRANSLATIONS.map((t) => [t.id, t]));
  for (const [id, t] of translations) mergedTranslations.set(id, t);
  for (const id of deletedTranslations) mergedTranslations.delete(id);

  return {
    collections: [...mergedCollections.values()].sort((a, b) => a.sort_order - b.sort_order),
    articles: [...mergedArticles.values()],
    translations: [...mergedTranslations.values()],
  };
}

export function localUpsertCollection(collection: HelpCollection) {
  collections.set(collection.id, collection);
  deletedCollections.delete(collection.id);
}

export function localDeleteCollection(id: string) {
  collections.delete(id);
  deletedCollections.add(id);
}

export function localUpsertArticle(article: HelpArticle) {
  articles.set(article.id, article);
}

export function localUpsertTranslation(translation: HelpArticleTranslation) {
  translations.set(translation.id, translation);
  deletedTranslations.delete(translation.id);
}

export function localDeleteTranslation(id: string) {
  translations.delete(id);
  deletedTranslations.add(id);
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------
// The files themselves land in `public/help-uploads/`, so the index lives on
// disk beside them: in development the upload route and the pages are built
// as separate module graphs and would not see one process-memory map.

const mediaIndexPath = join(process.cwd(), "public", "help-uploads", "index.json");

function readMediaIndex(): HelpMedia[] {
  try {
    return JSON.parse(readFileSync(mediaIndexPath, "utf8")) as HelpMedia[];
  } catch {
    return [];
  }
}

function writeMediaIndex(rows: HelpMedia[]) {
  mkdirSync(dirname(mediaIndexPath), { recursive: true });
  writeFileSync(mediaIndexPath, JSON.stringify(rows, null, 2), "utf8");
}

export function localMedia(): HelpMedia[] {
  return readMediaIndex().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function localUpsertMedia(row: HelpMedia) {
  const rows = readMediaIndex().filter((m) => m.id !== row.id);
  rows.push(row);
  writeMediaIndex(rows);
}

export function localDeleteMedia(id: string) {
  writeMediaIndex(readMediaIndex().filter((m) => m.id !== id));
}

// ---------------------------------------------------------------------------
// Redirects and unknown paths
// ---------------------------------------------------------------------------

const redirectsPath = join(process.cwd(), "public", "help-uploads", "redirects.json");
const notFoundPath = join(process.cwd(), "public", "help-uploads", "not-found.json");

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
}

export function localRedirects(): HelpRedirect[] {
  return readJson<HelpRedirect[]>(redirectsPath, []).sort(
    (a, b) => b.hits - a.hits || a.source_path.localeCompare(b.source_path),
  );
}

export function localUpsertRedirect(row: HelpRedirect) {
  const rows = readJson<HelpRedirect[]>(redirectsPath, []).filter(
    (r) => r.id !== row.id && r.source_path !== row.source_path,
  );
  rows.push(row);
  writeJson(redirectsPath, rows);
}

export function localDeleteRedirect(id: string) {
  writeJson(redirectsPath, readJson<HelpRedirect[]>(redirectsPath, []).filter((r) => r.id !== id));
}

export function localFollowRedirect(
  candidates: string[],
): { target_path: string; status_code: number } | null {
  const rows = readJson<HelpRedirect[]>(redirectsPath, []);
  for (const path of candidates) {
    const hit = rows.find((r) => r.source_path === path);
    if (hit) {
      hit.hits += 1;
      writeJson(redirectsPath, rows);
      return { target_path: hit.target_path, status_code: hit.status_code };
    }
  }
  return null;
}

export interface LocalNotFound {
  path: string;
  hits: number;
  first_seen: string;
  last_seen: string;
}

export function localNoteNotFound(path: string) {
  const rows = readJson<LocalNotFound[]>(notFoundPath, []);
  const now = new Date().toISOString();
  const existing = rows.find((r) => r.path === path);
  if (existing) {
    existing.hits += 1;
    existing.last_seen = now;
  } else {
    rows.push({ path: path.slice(0, 500), hits: 1, first_seen: now, last_seen: now });
  }
  writeJson(notFoundPath, rows);
}

export function localNotFound(): LocalNotFound[] {
  return readJson<LocalNotFound[]>(notFoundPath, []).sort((a, b) => b.hits - a.hits);
}

// ---------------------------------------------------------------------------
// Events (views, search log, feedback) and content-gap dismissals
// ---------------------------------------------------------------------------
// On disk for the same reason as media and redirects: the API routes that
// write them and the admin pages that read them are separate module graphs in
// development, so a process-memory store would look permanently empty.

const eventsPath = join(process.cwd(), "public", "help-uploads", "events.json");

export interface LocalView {
  articleId: string;
  language: Locale;
  viewedAt: string;
  sessionHash: string;
}

export interface LocalSearchQuery {
  id: string;
  query: string;
  language: Locale;
  resultsCount: number;
  clickedArticleId: string | null;
  createdAt: string;
}

export interface LocalFeedback {
  id: string;
  articleId: string;
  language: Locale;
  isHelpful: boolean;
  comment: string | null;
  visitorHash: string;
  createdAt: string;
}

interface LocalEvents {
  views: LocalView[];
  searches: LocalSearchQuery[];
  feedback: LocalFeedback[];
  dismissals: { kind: "query" | "feedback"; ref: string }[];
}

function readEvents(): LocalEvents {
  const empty: LocalEvents = { views: [], searches: [], feedback: [], dismissals: [] };
  try {
    return { ...empty, ...(JSON.parse(readFileSync(eventsPath, "utf8")) as Partial<LocalEvents>) };
  } catch {
    return empty;
  }
}

function writeEvents(events: LocalEvents) {
  mkdirSync(dirname(eventsPath), { recursive: true });
  writeFileSync(eventsPath, JSON.stringify(events, null, 2), "utf8");
}

export function localRecordView(view: LocalView) {
  const events = readEvents();
  events.views.push(view);
  writeEvents(events);
}

export function localLogSearch(
  entry: Omit<LocalSearchQuery, "id" | "createdAt" | "clickedArticleId">,
) {
  const events = readEvents();
  const row: LocalSearchQuery = {
    ...entry,
    id: crypto.randomUUID(),
    clickedArticleId: null,
    createdAt: new Date().toISOString(),
  };
  events.searches.push(row);
  writeEvents(events);
  return row.id;
}

export function localRecordSearchClick(queryId: string, articleId: string): boolean {
  const events = readEvents();
  const row = events.searches.find((q) => q.id === queryId);
  if (!row) return false;
  row.clickedArticleId = articleId;
  writeEvents(events);
  return true;
}

export function localAddFeedback(entry: Omit<LocalFeedback, "id" | "createdAt">) {
  const events = readEvents();
  events.feedback.push({
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
  writeEvents(events);
}

export function localHasFeedback(articleId: string, visitorHash: string): boolean {
  return readEvents().feedback.some(
    (f) => f.articleId === articleId && f.visitorHash === visitorHash,
  );
}

export function localDismissGap(kind: "query" | "feedback", ref: string) {
  const events = readEvents();
  if (!events.dismissals.some((d) => d.kind === kind && d.ref === ref)) {
    events.dismissals.push({ kind, ref });
    writeEvents(events);
  }
}

/** Read seams for the analytics dashboard and for tests. */
export function localEvents(): LocalEvents {
  return readEvents();
}
