/**
 * Trigram similarity, the same measure Postgres' `pg_trgm` uses, so the local
 * seed-backed search ranks the way the database does once it is connected.
 *
 * A string is padded with two spaces in front and one behind per word, then
 * cut into overlapping three-character windows; similarity is the size of the
 * intersection over the union of the two trigram sets. Typos, partial words
 * and the singular/plural pairs Arabic forms by changing an ending all land in
 * the same neighbourhood.
 *
 * No `@/` imports here on purpose: the tests run this file directly in Node.
 */

export function trigrams(text: string): Set<string> {
  const set = new Set<string>();
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i++) set.add(padded.slice(i, i + 3));
  }
  return set;
}

export function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const ta = trigrams(a);
  const tb = trigrams(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  const union = ta.size + tb.size - shared;
  return union === 0 ? 0 : shared / union;
}

/**
 * How well `needle` matches the best-matching word in `haystack` — the
 * counterpart of `word_similarity()`, which is what lets a two-word query find
 * a twelve-word title.
 */
export function bestWordSimilarity(needle: string, haystack: string): number {
  let best = 0;
  for (const word of haystack.split(/\s+/)) {
    if (!word) continue;
    if (word === needle) return 1;
    if (word.startsWith(needle) && needle.length >= 2) best = Math.max(best, 0.9);
    best = Math.max(best, trigramSimilarity(needle, word));
  }
  return best;
}
