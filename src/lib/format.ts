import type { Locale } from "@/i18n/config";

/**
 * All date formatting happens on the server and is handed to the client as a
 * plain string. That keeps Intl output identical on both sides (no hydration
 * mismatch) and lets us pin Western digits in Arabic, per the brand guidelines.
 */

// `-u-nu-latn` forces 0-9 instead of ١-٩ while keeping Arabic month names.
const FORMATTER_LOCALE: Record<Locale, string> = {
  ar: "ar-EG-u-nu-latn",
  en: "en-GB",
};

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: Locale, options: Intl.DateTimeFormatOptions) {
  const key = `${locale}:${JSON.stringify(options)}`;
  let cached = dateFormatters.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(FORMATTER_LOCALE[locale], {
      timeZone: "UTC",
      ...options,
    });
    dateFormatters.set(key, cached);
  }
  return cached;
}

/** e.g. "15 سبتمبر 2026" / "15 September 2026" */
export function formatDate(iso: string, locale: Locale): string {
  return formatter(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** e.g. "سبتمبر 2026" / "September 2026" — used to group the changelog. */
export function formatMonth(iso: string, locale: Locale): string {
  return formatter(locale, { month: "long", year: "numeric" }).format(new Date(iso));
}

export const NEW_BADGE_DAYS = 14;

export function isNew(iso: string, now: number = Date.now()): boolean {
  return now - Date.parse(iso) < NEW_BADGE_DAYS * 86_400_000;
}
