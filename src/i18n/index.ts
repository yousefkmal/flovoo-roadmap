import ar from "@/i18n/dictionaries/ar";
import en from "@/i18n/dictionaries/en";
import type { Locale } from "@/i18n/config";

export type Dictionary = typeof ar;

const DICTIONARIES: Record<Locale, Dictionary> = { ar, en: en as Dictionary };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/**
 * Fills `{placeholders}` in a dictionary string. Values are stringified with
 * Western digits in both locales, per the brand guidelines.
 */
export function t(
  template: string,
  values: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
