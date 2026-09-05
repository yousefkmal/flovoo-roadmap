import type { Locale } from "@/lib/types";

/**
 * Public URLs for the help center.
 *
 * The help center is part of this app and its routes live under
 * `/[locale]/help/*`. In production it is served from its own host
 * (`help.flovoo.com`), where `proxy.ts` maps `/ar/articles/…` onto
 * `/ar/help/articles/…`. Static HTML cannot know which host it will be served
 * from, so every link is built here from one setting:
 *
 *   NEXT_PUBLIC_HELP_URL unset  →  /ar/help/articles/…        (local, previews)
 *   NEXT_PUBLIC_HELP_URL set    →  https://help.flovoo.com/ar/articles/…
 *
 * Slugs are stored verbatim — Arabic included — and percent-encoded only here.
 */

const HELP_URL = process.env.NEXT_PUBLIC_HELP_URL?.replace(/\/$/, "") || null;

/** The route segment the help center lives under inside the app. */
export const HELP_SEGMENT = "help";

/** The hostname the help center is served from, when one is configured. */
export function helpHost(): string | null {
  if (!HELP_URL) return null;
  try {
    return new URL(HELP_URL).hostname;
  } catch {
    return null;
  }
}

function base(locale: Locale): string {
  return HELP_URL ? `${HELP_URL}/${locale}` : `/${locale}/${HELP_SEGMENT}`;
}

export function helpHomeHref(locale: Locale): string {
  return base(locale);
}

export function helpCollectionHref(locale: Locale, slug: string): string {
  return `${base(locale)}/categories/${encodeURIComponent(slug)}`;
}

export function helpArticleHref(locale: Locale, slug: string): string {
  return `${base(locale)}/articles/${encodeURIComponent(slug)}`;
}

/** The results page arrives in Phase 2; the form on the home page already posts here. */
export function helpSearchHref(locale: Locale): string {
  return `${base(locale)}/search`;
}

/**
 * Dynamic params arrive decoded in the App Router, but a slug typed by hand or
 * copied out of an old link can still carry `%D8…` sequences. Decoding twice
 * is harmless for a plain string; a malformed sequence is left as it is.
 */
export function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Where the help center points at the rest of Flovoo, shown in its footer.
 * Absolute, because on the help host a relative `/ar` would be the help home.
 * Grows as destinations exist; the header stays uncrowded.
 */
export function helpFooterLinks(
  locale: Locale,
  siteOrigin: URL,
  labels: { roadmap: string; updates: string },
): { label: string; href: string }[] {
  return [
    { label: labels.roadmap, href: new URL(`/${locale}`, siteOrigin).toString() },
    { label: labels.updates, href: new URL(`/${locale}/updates`, siteOrigin).toString() },
  ];
}
