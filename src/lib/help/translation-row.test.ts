import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { translationRow, type HelpTranslationInput } from "./translation-row.ts";
import type { HelpArticleTranslation } from "./types.ts";

/**
 * What a save writes, and when a drafted summary stops counting as a draft.
 *
 * The first test exists because of a real loss: a second column list inlined in
 * the Supabase upsert dropped four fields, so a writer could type a summary,
 * press Save, see no error, and find the field empty on reopening.
 *
 *   npm test
 */

const NOW = "2026-09-09T10:00:00.000Z";

function input(overrides: Partial<HelpTranslationInput> = {}): HelpTranslationInput {
  return {
    slug: "how-to-connect",
    title: "كيف تربط واتساب",
    excerpt: "شرح مختصر.",
    body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "نص" }] }] },
    meta_title: null,
    meta_description: null,
    answer_summary: "الإجابة المباشرة.",
    summary_reviewed: false,
    question_title: "كيف أربط واتساب بفلوفو؟",
    key_facts: ["حقيقة أولى", "حقيقة ثانية"],
    review_due_at: null,
    ...overrides,
  };
}

function stored(overrides: Partial<HelpArticleTranslation> = {}): HelpArticleTranslation {
  return {
    ...translationRow("article-1", "ar", input(), undefined, NOW),
    ...overrides,
  };
}

describe("translationRow", () => {
  it("carries every field a writer can edit", () => {
    const row = translationRow("article-1", "ar", input(), undefined, NOW);
    assert.equal(row.excerpt, "شرح مختصر.");
    assert.equal(row.answer_summary, "الإجابة المباشرة.");
    assert.equal(row.question_title, "كيف أربط واتساب بفلوفو؟");
    assert.deepEqual(row.key_facts, ["حقيقة أولى", "حقيقة ثانية"]);
    assert.equal(row.meta_title, null);
  });

  it("keeps the identity of the row it replaces", () => {
    const existing = stored({ id: "row-42", created_at: "2026-01-01T00:00:00.000Z" });
    const row = translationRow("article-1", "ar", input(), existing, NOW);
    assert.equal(row.id, "row-42");
    assert.equal(row.created_at, "2026-01-01T00:00:00.000Z");
    assert.equal(row.updated_at, NOW);
  });

  it("leaves a fresh summary reviewed", () => {
    const row = translationRow("article-1", "ar", input(), undefined, NOW);
    assert.equal(row.summary_needs_review, false);
  });

  it("keeps an unreviewed draft unreviewed while nobody touches it", () => {
    const existing = stored({ summary_needs_review: true, answer_summary: "الإجابة المباشرة." });
    const row = translationRow("article-1", "ar", input(), existing, NOW);
    assert.equal(row.summary_needs_review, true);
  });

  it("clears the flag when the writer rewrites the summary", () => {
    const existing = stored({ summary_needs_review: true, answer_summary: "نص آلي قديم." });
    const row = translationRow("article-1", "ar", input({ answer_summary: "نص كتبه إنسان." }), existing, NOW);
    assert.equal(row.summary_needs_review, false);
  });

  it("clears the flag when the writer presses approve", () => {
    const existing = stored({ summary_needs_review: true, answer_summary: "الإجابة المباشرة." });
    const row = translationRow("article-1", "ar", input({ summary_reviewed: true }), existing, NOW);
    assert.equal(row.summary_needs_review, false);
  });

  it("derives the body fields rather than trusting the caller", () => {
    const row = translationRow("article-1", "ar", input(), undefined, NOW);
    assert.equal(row.body_plain, "نص");
    assert.ok(row.reading_minutes >= 1);
  });
});
