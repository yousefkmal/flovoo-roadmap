import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  contentScore,
  runContentChecks,
  sentenceCount,
  startsWithReference,
  wordCount,
  type ContentSnapshot,
} from "./content-checks.ts";

/**
 * The readiness checklist decides what the editor nags about and what the
 * article list ranks by. Two properties matter most and are pinned here: a
 * check that does not apply must leave the score entirely, and nothing here may
 * ever block anything — that is enforced in the action, but the weights and the
 * "not applicable" rule are what make the number honest.
 *
 *   npm test
 */

const LONG = Array.from({ length: 50 }, (_, i) => `كلمة${i}`).join(" ");

function snapshot(overrides: Partial<ContentSnapshot> = {}): ContentSnapshot {
  return {
    language: "ar",
    title: "كيف تربط واتساب",
    metaTitle: "كيف تربط واتساب بفلوفو",
    metaDescription: "ا".repeat(120),
    answerSummary: LONG,
    questionTitle: "كيف أربط واتساب؟",
    keyFacts: ["أولى", "ثانية", "ثالثة"],
    headings: [
      { level: 2, text: "الخطوات" },
      { level: 2, text: "الأسئلة" },
    ],
    paragraphs: ["جملة واحدة قصيرة.", "جملة أخرى قصيرة."],
    plainText: "نص بلا أرقام",
    images: [],
    internalLinks: 2,
    hasFaq: true,
    hasOtherLanguage: true,
    updatedAt: new Date().toISOString(),
    reviewDueAt: new Date(Date.now() + 86_400_000).toISOString(),
    ...overrides,
  };
}

const byId = (s: ContentSnapshot) => new Map(runContentChecks(s).map((c) => [c.id, c]));

describe("content checks", () => {
  it("weights sum to 100 when everything applies", () => {
    const total = runContentChecks(
      snapshot({ plainText: "الحد 256 جهة", images: [{ alt: "وصف", altIsDraft: false }], focusKeyword: "واتساب" }),
    ).reduce((sum, c) => sum + c.weight, 0);
    assert.equal(total, 100);
  });

  it("scores a complete article 100", () => {
    assert.equal(contentScore(runContentChecks(snapshot())), 100);
  });

  it("drops a check that does not apply, rather than failing it", () => {
    const noImages = byId(snapshot());
    assert.equal(noImages.get("images.alt")!.passed, null);
    assert.equal(noImages.get("images.altReviewed")!.passed, null);
    // An article with no images still scores 100 — it is not missing alt text.
    assert.equal(contentScore(runContentChecks(snapshot())), 100);
  });

  it("asks for key facts only when the article states numbers", () => {
    assert.equal(byId(snapshot({ keyFacts: [] })).get("keyFacts.whenNumbers")!.passed, null);
    assert.equal(
      byId(snapshot({ keyFacts: [], plainText: "الحد 256 جهة اتصال" })).get("keyFacts.whenNumbers")!.passed,
      false,
    );
    // Arabic-Indic digits count as numbers too.
    assert.equal(
      byId(snapshot({ keyFacts: [], plainText: "الحد ٢٥٦ جهة" })).get("keyFacts.whenNumbers")!.passed,
      false,
    );
  });

  it("skips the focus keyword where the field does not exist", () => {
    assert.equal(byId(snapshot()).get("keyword.placement")!.passed, null);
    assert.equal(byId(snapshot({ focusKeyword: "واتساب" })).get("keyword.placement")!.passed, true);
    assert.equal(byId(snapshot({ focusKeyword: "تيك توك" })).get("keyword.placement")!.passed, false);
  });

  it("marks the direct answer as the heaviest single item", () => {
    const checks = runContentChecks(snapshot());
    const summary = checks.find((c) => c.id === "summary.present")!;
    assert.equal(summary.weight, 14);
    assert.equal(summary.severity, "error");
    assert.ok(checks.every((c) => c.weight <= summary.weight));
  });

  it("catches a meta description that is too short or too long", () => {
    assert.equal(byId(snapshot({ metaDescription: "قصير" })).get("meta.description")!.passed, false);
    assert.equal(byId(snapshot({ metaDescription: "ا".repeat(200) })).get("meta.description")!.passed, false);
  });

  it("catches a level-three heading opening the article", () => {
    const checks = byId(snapshot({ headings: [{ level: 3, text: "تفصيل" }, { level: 2, text: "قسم" }] }));
    assert.equal(checks.get("headings.order")!.passed, false);
  });

  it("catches a paragraph that runs past four sentences", () => {
    const checks = byId(snapshot({ paragraphs: ["واحد. اثنان. ثلاثة. أربعة. خمسة."] }));
    assert.equal(checks.get("paragraphs.short")!.passed, false);
  });

  it("catches a section that leans on the one before it", () => {
    const checks = byId(snapshot({ paragraphs: ["كما ذكرنا في الأعلى، الأمر بسيط."] }));
    assert.equal(checks.get("sections.selfContained")!.passed, false);
  });

  it("never returns a score above 100 or below 0", () => {
    const worst = contentScore(
      runContentChecks(
        snapshot({
          answerSummary: null,
          questionTitle: null,
          metaTitle: null,
          metaDescription: null,
          headings: [],
          paragraphs: [],
          hasFaq: false,
          internalLinks: 0,
          hasOtherLanguage: false,
          updatedAt: "2020-01-01T00:00:00.000Z",
          reviewDueAt: "2020-01-01T00:00:00.000Z",
        }),
      ),
    );
    assert.ok(worst >= 0 && worst <= 100, `score was ${worst}`);
    // Not zero, and honestly so: an article with no headings at all does not
    // put a level-three heading before a level-two one, so that check passes.
    assert.ok(worst <= 10, `an empty article scored ${worst}`);
  });
});

describe("helpers", () => {
  it("counts words and sentences in both scripts", () => {
    assert.equal(wordCount("one two three"), 3);
    assert.equal(wordCount("  "), 0);
    assert.equal(sentenceCount("واحد. اثنان؟ ثلاثة!"), 3);
    assert.equal(sentenceCount("بلا نقطة"), 1);
  });

  it("recognises an opener that points backwards", () => {
    assert.equal(startsWithReference("كما رأينا", "ar"), true);
    assert.equal(startsWithReference("افتح الإعدادات", "ar"), false);
    assert.equal(startsWithReference("This is why", "en"), true);
    assert.equal(startsWithReference("Open settings", "en"), false);
  });
});
