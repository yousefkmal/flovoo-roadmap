/**
 * Arabic text normalization for search.
 *
 * Postgres full-text search treats "أ" and "ا", "ة" and "ه", "الحملات" and
 * "حملات" as unrelated strings. Readers do not. Both the indexed text and the
 * incoming query pass through the same normalization, so a query typed with
 * or without hamza, with or without the definite article, lands on the same
 * trigrams as the article it is looking for.
 *
 * `help_normalize()` in `supabase/migrations/0006_help_search.sql` is the same
 * function in SQL. Change one and change the other; `arabic.test.ts` pins the
 * TypeScript side.
 *
 * No `@/` imports here on purpose: the tests run this file directly in Node.
 */

/** Tashkeel, Quranic annotation marks and the tatweel (kashida) stretch. */
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** Alef variants and the two letters that are commonly typed interchangeably. */
const LETTER_MAP: Record<string, string> = {
  "أ": "ا", // أ → ا
  "إ": "ا", // إ → ا
  "آ": "ا", // آ → ا
  "ٱ": "ا", // ٱ → ا
  "ى": "ي", // ى → ي
  "ة": "ه", // ة → ه
  "ؤ": "و", // ؤ → و
  "ئ": "ي", // ئ → ي
};
const LETTERS = /[أإآٱىةؤئ]/g;

/** Arabic-Indic (٠–٩) and Eastern Arabic-Indic (۰–۹) digits to 0–9. */
const DIGITS = /[٠-٩۰-۹]/g;

/** Anything that is not a letter, a digit or whitespace becomes a space. */
const PUNCTUATION = /[^\p{L}\p{N}\s]+/gu;

/**
 * Prefixes that fuse the definite article onto a word: ال itself, and the
 * conjunction or preposition + ال forms (وال، بال، فال، كال) and لل. Stripped
 * only when enough of the word remains, so "الم" is left alone.
 */
const ARTICLE_PREFIXES = ["وال", "بال", "فال", "كال", "ال", "لل"];
const MIN_STEM_LENGTH = 3;

/** Character-level normalization: case, diacritics, letter variants, digits. */
export function normalizeArabic(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(DIACRITICS, "")
    .replace(LETTERS, (ch) => LETTER_MAP[ch] ?? ch)
    .replace(DIGITS, (d) => String(d.charCodeAt(0) % 16))
    .replace(PUNCTUATION, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Drops a fused definite article from one already-normalized token. */
export function stripDefiniteArticle(token: string): string {
  for (const prefix of ARTICLE_PREFIXES) {
    if (token.startsWith(prefix) && token.length - prefix.length >= MIN_STEM_LENGTH) {
      return token.slice(prefix.length);
    }
  }
  return token;
}

/** Normalized tokens with articles stripped — what both sides of a match compare. */
export function searchTokens(text: string): string[] {
  return normalizeArabic(text)
    .split(" ")
    .filter(Boolean)
    .map(stripDefiniteArticle);
}

/** The full normalization pipeline as one string, for indexing and matching. */
export function normalizeForSearch(text: string): string {
  return searchTokens(text).join(" ");
}
