import { LOCALES, type Locale } from "@/lib/types";

export { LOCALES };
export type { Locale };

/** Arabic is the default — Flovoo is an Arabic-first product. */
export const DEFAULT_LOCALE: Locale = "ar";

export const LOCALE_COOKIE = "flovoo_locale";
/** One year, in seconds — the language choice should outlive the session. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const DIRECTION: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

/** Endonyms: each language is always written in its own script. */
export const LOCALE_LABEL: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
};

export const LOCALE_SHORT_LABEL: Record<Locale, string> = {
  ar: "ع",
  en: "EN",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function otherLocale(locale: Locale): Locale {
  return locale === "ar" ? "en" : "ar";
}
