import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bodyText, isChangelogBody, isEmptyBody, plainToDoc, toChangelogBody } from "./body.ts";

/**
 * Migration 0012 changed changelog bodies from text to block documents. These
 * pin the conversion both ways, including the case that matters most: a row
 * written before the migration still has to render.
 *
 *   npm test
 */

describe("plainToDoc", () => {
  it("makes one paragraph per blank-line-separated block", () => {
    const doc = plainToDoc("first\n\nsecond\n\nthird");
    assert.equal(doc.content.length, 3);
    assert.deepEqual(doc.content[0], {
      type: "paragraph",
      content: [{ type: "text", text: "first" }],
    });
  });

  it("keeps single newlines inside a paragraph", () => {
    const doc = plainToDoc("one line\nstill the same paragraph");
    assert.equal(doc.content.length, 1);
    assert.equal(bodyText(doc), "one line\nstill the same paragraph");
  });

  it("drops empty blocks and trims each paragraph", () => {
    const doc = plainToDoc("  padded  \n\n\n\n   \n\nlast");
    assert.equal(doc.content.length, 2);
    assert.equal(bodyText(doc), "padded\n\nlast");
  });

  it("turns nothing into an empty document, not null", () => {
    for (const empty of ["", "   ", null, undefined]) {
      const doc = plainToDoc(empty);
      assert.equal(doc.type, "doc");
      assert.deepEqual(doc.content, []);
      assert.equal(isEmptyBody(doc), true);
    }
  });
});

describe("toChangelogBody", () => {
  it("passes a document through untouched", () => {
    const doc = plainToDoc("already a document");
    assert.equal(toChangelogBody(doc), doc);
  });

  it("reads a pre-migration plain string as paragraphs", () => {
    const doc = toChangelogBody("old row\n\nfrom before the migration");
    assert.equal(doc.content.length, 2);
  });

  it("degrades anything else to an empty document rather than throwing", () => {
    for (const junk of [null, undefined, 42, [], { type: "notADoc" }, { content: [] }]) {
      const doc = toChangelogBody(junk);
      assert.equal(doc.type, "doc");
      assert.deepEqual(doc.content, []);
    }
  });
});

describe("isChangelogBody", () => {
  it("accepts a document and rejects everything else", () => {
    assert.equal(isChangelogBody({ type: "doc", content: [] }), true);
    assert.equal(isChangelogBody({ type: "doc" }), false, "content must be an array");
    assert.equal(isChangelogBody("text"), false);
    assert.equal(isChangelogBody(null), false);
  });
});

describe("bodyText", () => {
  it("reads the text out of a rich body, lists included", () => {
    const doc = {
      type: "doc" as const,
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Intro" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "two" }] }] },
          ],
        },
      ],
    };
    const text = bodyText(doc);
    assert.ok(text.includes("Intro"));
    assert.ok(text.includes("one"));
    assert.ok(text.includes("two"));
  });
});
