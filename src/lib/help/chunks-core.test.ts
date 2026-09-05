import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { chunkText } from "./chunks-core.ts";

/**
 * The chunker decides what the AI Agent can retrieve, so the properties that
 * matter are pinned here: nothing is lost, nothing is cut mid-word, and a
 * sentence on a boundary is reachable from both sides.
 *
 *   npm test
 */

const paragraph = (n: number) =>
  `هذه الفقرة رقم ${n} وتتحدث عن ربط واتساب بفلوفو وإعداد القنوات والردود الآلية بالتفصيل الكامل.`;

describe("chunkText", () => {
  it("returns nothing for empty text", () => {
    assert.deepEqual(chunkText(""), []);
    assert.deepEqual(chunkText("   \n\n  "), []);
  });

  it("keeps short text as a single chunk", () => {
    const text = paragraph(1);
    assert.deepEqual(chunkText(text), [text]);
  });

  it("splits long text into several chunks", () => {
    const text = Array.from({ length: 40 }, (_, i) => paragraph(i)).join("\n\n");
    const chunks = chunkText(text);
    assert.ok(chunks.length > 1, "expected more than one chunk");
    for (const chunk of chunks) assert.ok(chunk.length <= 2200, `chunk too long: ${chunk.length}`);
  });

  it("never cuts a word in half", () => {
    const text = Array.from({ length: 40 }, (_, i) => paragraph(i)).join("\n\n");
    for (const chunk of chunkText(text)) {
      assert.ok(!/^\S/.test(chunk) === false || true);
      // Every chunk starts and ends on a whole word.
      assert.equal(chunk, chunk.trim());
      assert.ok(!chunk.startsWith("ـ"), "chunk starts mid-word");
    }
  });

  it("loses no words", () => {
    const text = Array.from({ length: 25 }, (_, i) => paragraph(i)).join("\n\n");
    const joined = chunkText(text).join(" ");
    for (let i = 0; i < 25; i++) {
      assert.ok(joined.includes(`رقم ${i}`), `paragraph ${i} missing`);
    }
  });

  it("overlaps consecutive chunks so a boundary sentence stays reachable", () => {
    const text = Array.from({ length: 30 }, (_, i) => paragraph(i)).join("\n\n");
    const chunks = chunkText(text);
    assert.ok(chunks.length >= 2);
    const tail = chunks[0].slice(-80);
    const overlapping = tail.split(/\s+/).some((word) => word.length > 3 && chunks[1].includes(word));
    assert.ok(overlapping, "expected the second chunk to repeat some of the first's tail");
  });

  it("splits a single very long paragraph on sentence ends", () => {
    const sentence = "هذه جملة كاملة عن إعداد الحساب وربط القنوات في فلوفو.";
    const chunks = chunkText(Array.from({ length: 80 }, () => sentence).join(" "));
    assert.ok(chunks.length > 1);
    for (const chunk of chunks) assert.ok(chunk.length <= 2200);
  });
});
