import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  geoScore,
  runGeoChecks,
  sentenceCount,
  startsWithReference,
  summaryBlocksPublish,
  wordCount,
  type GeoInput,
} from "./geo.ts";

/**
 * The readiness checks decide what the editor nags about, and one of them
 * decides what publishing refuses. Both directions are pinned here.
 *
 *   npm test
 */

const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const h = (text: string) => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] });

function input(overrides: Partial<GeoInput> = {}): GeoInput {
  return {
    title: "ربط رقم واتساب",
    answerSummary: "ا ".repeat(50).trim(),
    questionTitle: "كيف أربط رقم واتساب بفلوفو؟",
    keyFacts: ["حد الإرسال 250", "يلزم حساب ميتا", "الربط يستغرق دقائق"],
    body: { type: "doc", content: [h("الخطوات"), p("افتح الإعدادات ثم اختر القنوات.")] },
    language: "ar",
    ...overrides,
  };
}

describe("word and sentence counting", () => {
  it("counts words in both scripts", () => {
    assert.equal(wordCount("one two three"), 3);
    assert.equal(wordCount("افتح الإعدادات ثم اختر"), 4);
    assert.equal(wordCount("   "), 0);
  });

  it("counts sentences across Arabic and Latin punctuation", () => {
    assert.equal(sentenceCount("One. Two. Three."), 3);
    assert.equal(sentenceCount("جملة واحدة؟ وجملة ثانية."), 2);
  });
});

describe("self-contained passages", () => {
  it("flags a paragraph that leans on what came before", () => {
    assert.equal(startsWithReference("كذلك يمكنك الضغط على حفظ", "ar"), true);
    assert.equal(startsWithReference("Also, press save", "en"), true);
    assert.equal(startsWithReference("Then press save", "en"), true);
  });

  it("leaves a paragraph that stands on its own", () => {
    assert.equal(startsWithReference("افتح صفحة القنوات ثم اضغط ربط", "ar"), false);
    assert.equal(startsWithReference("Open the channels page", "en"), false);
  });

  it("scores a section lower when its first paragraph refers backwards", () => {
    const standalone = geoScore(runGeoChecks(input()));
    const dependent = geoScore(
      runGeoChecks(
        input({ body: { type: "doc", content: [h("الخطوات"), p("كذلك اضغط على حفظ.")] } }),
      ),
    );
    assert.ok(dependent < standalone, "a dependent opening must cost points");
  });
});

describe("publishing", () => {
  it("refuses a summary that is missing or far outside the range", () => {
    assert.equal(summaryBlocksPublish(null), true);
    assert.equal(summaryBlocksPublish(""), true);
    assert.equal(summaryBlocksPublish("too short"), true);
    assert.equal(summaryBlocksPublish("w ".repeat(200)), true);
  });

  it("allows a summary in range, and tolerates just outside it", () => {
    assert.equal(summaryBlocksPublish("w ".repeat(50).trim()), false);
    // 30 words is under the 40-word target but not worth blocking a publish.
    assert.equal(summaryBlocksPublish("w ".repeat(30).trim()), false);
  });
});

describe("the score", () => {
  it("is 0-100 and rewards a well-formed article", () => {
    const score = geoScore(runGeoChecks(input()));
    assert.ok(score >= 0 && score <= 100);
    assert.ok(score > 60, `a well-formed article should score well, got ${score}`);
  });

  it("drops sharply without a summary, which is the load-bearing field", () => {
    const without = geoScore(runGeoChecks(input({ answerSummary: null })));
    const with_ = geoScore(runGeoChecks(input()));
    assert.ok(with_ - without >= 25, "the summary must dominate the score");
  });

  it("asks for key facts only when the article states numbers", () => {
    const noNumbers = runGeoChecks(
      input({ keyFacts: [], body: { type: "doc", content: [h("عن الميزة"), p("شرح بلا أرقام.")] } }),
    );
    assert.equal(noNumbers.find((c) => c.id === "keyFacts.whenNumbers")?.passed, true);

    const withNumbers = runGeoChecks(
      input({ keyFacts: [], body: { type: "doc", content: [h("الحدود"), p("الحد اليومي 250 عميلًا.")] } }),
    );
    assert.equal(withNumbers.find((c) => c.id === "keyFacts.whenNumbers")?.passed, false);
  });
});
