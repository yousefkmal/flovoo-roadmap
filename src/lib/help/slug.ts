/**
 * A URL slug from a title: letters and digits of any script, hyphens between
 * words. Arabic slugs stay Arabic — the brief's choice, and better for Arabic
 * search than transliteration.
 *
 * Lives outside the editor module because the server prefills a slug too, when
 * the content-gap inbox opens the editor with a question already written, and
 * a server component cannot import from a `"use client"` file.
 */
export function suggestSlug(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u065F\u0640]/g, "")
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, 80);
}
