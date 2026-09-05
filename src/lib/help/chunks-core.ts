/**
 * Passage splitting for retrieval. Pure and dependency-free so it can be unit
 * tested directly (`chunks-core.test.ts`); `chunks.ts` adds the database and
 * embedding side of the job around it.
 */

/**
 * ~500 tokens. Arabic runs about three characters per token and English four,
 * so 1,600 characters is a safe middle for a bilingual corpus; the overlap
 * keeps a sentence that straddles a boundary retrievable from either side.
 */
const TARGET_CHARS = 1600;
const OVERLAP_CHARS = 200;
const MIN_CHARS = 120;

/**
 * Splits plain text into passages on paragraph boundaries first, then
 * sentences, never mid-word. Arabic sentence enders (؟ ،) count alongside the
 * Latin ones.
 */
export function chunkText(
  text: string,
  targetChars = TARGET_CHARS,
  overlapChars = OVERLAP_CHARS,
): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= targetChars) return [clean];

  // Paragraphs are the natural unit; a paragraph longer than the target is
  // split again on sentence ends.
  const units: string[] = [];
  for (const paragraph of clean.split(/\n{2,}/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    if (trimmed.length <= targetChars) {
      units.push(trimmed);
      continue;
    }
    let current = "";
    for (const sentence of trimmed.split(/(?<=[.!?؟])\s+|\n+/)) {
      const piece = sentence.trim();
      if (!piece) continue;
      if (current && current.length + piece.length + 1 > targetChars) {
        units.push(current);
        current = piece;
      } else {
        current = current ? `${current} ${piece}` : piece;
      }
    }
    if (current) units.push(current);
  }

  const chunks: string[] = [];
  let buffer = "";
  for (const unit of units) {
    if (buffer && buffer.length + unit.length + 2 > targetChars) {
      chunks.push(buffer);
      // Carry the tail of the previous chunk so a boundary sentence is
      // retrievable from either passage.
      const tail = buffer.slice(-overlapChars);
      const cut = tail.search(/[\s\n]/);
      buffer = cut === -1 ? "" : tail.slice(cut + 1).trim();
    }
    buffer = buffer ? `${buffer}\n\n${unit}` : unit;
  }
  if (buffer.trim().length >= MIN_CHARS || chunks.length === 0) chunks.push(buffer.trim());
  else chunks[chunks.length - 1] += `\n\n${buffer.trim()}`;

  return chunks.filter(Boolean);
}
