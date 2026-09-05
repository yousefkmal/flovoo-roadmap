import "server-only";

import { getSupabase } from "@/lib/data/supabase";
import {
  localFollowRedirect,
  localNoteNotFound,
} from "@/lib/data/help-local-store";
import { isLocale } from "@/i18n/config";
import { redirectCandidates } from "@/lib/help/redirect-candidates";
import { HELP_SEGMENT, helpArticleHref, helpCollectionHref, helpHomeHref } from "@/lib/help/paths";
import type { Locale } from "@/lib/types";

/**
 * Redirects from old addresses — Intercom's `/en/articles/123-slug` and
 * `/en/collections/…` shapes, mostly — to the articles that replaced them.
 *
 * Lookups happen in the pages, not in `proxy.ts`: the proxy runs on every
 * request and must not wait on the database, while a redirect is only ever
 * needed once a path has failed to match anything real. Each hit is counted
 * so the redirects manager can show which old links are still alive.
 */

export interface RedirectHit {
  /** An internal href the page can hand to `permanentRedirect()`. */
  href: string;
  statusCode: number;
}

export { redirectCandidates } from "@/lib/help/redirect-candidates";

export async function followHelpRedirect(
  locale: Locale,
  publicPath: string,
): Promise<RedirectHit | null> {
  const candidates = redirectCandidates(locale, publicPath);
  const supabase = getSupabase();

  let row: { target_path: string; status_code: number } | null = null;
  if (!supabase) {
    row = localFollowRedirect(candidates);
  } else {
    const { data, error } = await supabase.rpc("help_redirect_hit", { candidates });
    if (error) {
      console.warn(`help redirects: lookup failed: ${error.message}`);
      return null;
    }
    row = (data as { target_path: string; status_code: number }[])[0] ?? null;
  }
  if (!row) return null;

  return { href: resolveHelpTarget(row.target_path, locale), statusCode: row.status_code };
}

export async function noteHelpNotFound(publicPath: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    localNoteNotFound(publicPath);
    return;
  }
  const { error } = await supabase.rpc("help_note_not_found", { missing_path: publicPath });
  if (error) console.warn(`help redirects: could not record 404: ${error.message}`);
}

/**
 * Redirect targets are stored as public paths (`/ar/articles/…`), which is
 * what the help host serves; internally the same page lives under `/help`.
 * This maps a stored target onto whatever the current deployment needs, and
 * leaves absolute URLs alone.
 */
export function resolveHelpTarget(target: string, fallbackLocale: Locale): string {
  if (/^https?:\/\//i.test(target)) return target;

  const match = target.match(/^\/(ar|en)(?:\/help)?(?:\/(articles|categories)\/([^/?#]+))?\/?(?:[?#].*)?$/);
  if (!match) return target.startsWith("/") ? target : helpHomeHref(fallbackLocale);

  const locale = isLocale(match[1]) ? match[1] : fallbackLocale;
  const kind = match[2];
  const slug = match[3] ? decodeURIComponent(match[3]) : null;
  if (kind === "articles" && slug) return helpArticleHref(locale, slug);
  if (kind === "categories" && slug) return helpCollectionHref(locale, slug);
  return helpHomeHref(locale);
}

/** The public form of an internal help path: drops the `/help` segment. */
export function publicHelpPath(internalPath: string): string {
  return internalPath.replace(new RegExp(`^/(ar|en)/${HELP_SEGMENT}(?=/|$)`), "/$1");
}

/**
 * Turns an old slug into something worth searching for: `123456-connect-your-
 * whatsapp-number` → `connect your whatsapp number`.
 */
export function humanizeLegacySlug(path: string): string {
  const last = decodeURIComponent(path.split("/").filter(Boolean).at(-1) ?? "");
  return last
    .replace(/^\d+-?/, "")
    .replace(/\.(html?|php)$/i, "")
    .replace(/[-_+]+/g, " ")
    .trim()
    .slice(0, 120);
}
