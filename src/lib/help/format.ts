import { t, type Dictionary } from "@/i18n";
import type { Locale } from "@/lib/types";

/**
 * Arabic counts take four forms (one, two, a few, many) where English takes
 * two, so a count is never formatted with a bare "{count} X" template. Intl
 * knows the rules for both; each dictionary carries the forms.
 */

interface PluralForms {
  zero?: string;
  one: string;
  two: string;
  few: string;
  many: string;
}

const rules = new Map<Locale, Intl.PluralRules>();

function pluralRules(locale: Locale) {
  let cached = rules.get(locale);
  if (!cached) {
    cached = new Intl.PluralRules(locale);
    rules.set(locale, cached);
  }
  return cached;
}

export function plural(locale: Locale, count: number, forms: PluralForms): string {
  if (count === 0 && forms.zero) return forms.zero;
  const category = pluralRules(locale).select(count);
  const template =
    category === "one"
      ? forms.one
      : category === "two"
        ? forms.two
        : category === "few"
          ? forms.few
          : forms.many;
  return t(template, { count });
}

export function articleCountLabel(dict: Dictionary, locale: Locale, count: number): string {
  return plural(locale, count, {
    zero: dict.help.articleCountZero,
    one: dict.help.articleCountOne,
    two: dict.help.articleCountTwo,
    few: dict.help.articleCountFew,
    many: dict.help.articleCountMany,
  });
}

export function readingTimeLabel(dict: Dictionary, locale: Locale, minutes: number): string {
  return plural(locale, Math.max(1, minutes), {
    one: dict.help.readingOne,
    two: dict.help.readingTwo,
    few: dict.help.readingFew,
    many: dict.help.readingMany,
  });
}

export function searchCountLabel(dict: Dictionary, locale: Locale, count: number): string {
  return plural(locale, count, {
    zero: dict.help.searchCountZero,
    one: dict.help.searchCountOne,
    two: dict.help.searchCountTwo,
    few: dict.help.searchCountFew,
    many: dict.help.searchCountMany,
  });
}

export function redirectCountLabel(dict: Dictionary, locale: Locale, count: number): string {
  return plural(locale, count, {
    zero: dict.adminHelp.redirectCountZero,
    one: dict.adminHelp.redirectCountOne,
    two: dict.adminHelp.redirectCountTwo,
    few: dict.adminHelp.redirectCountFew,
    many: dict.adminHelp.redirectCountMany,
  });
}
