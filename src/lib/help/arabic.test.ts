import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeArabic,
  normalizeForSearch,
  searchTokens,
  stripDefiniteArticle,
} from "./arabic.ts";

/**
 * Pins the normalizer to the cases the brief names (§13, criterion 2): hamza
 * variants, ta marbuta, the definite article, plus diacritics and digits.
 *
 *   npm test
 */

describe("normalizeArabic", () => {
  it("unifies hamza forms of alef", () => {
    assert.equal(normalizeArabic("أحمد إبراهيم آمنة"), "احمد ابراهيم امنه");
  });

  it("unifies ta marbuta with ha and alef maqsura with ya", () => {
    assert.equal(normalizeArabic("حملة"), "حمله");
    assert.equal(normalizeArabic("على"), "علي");
  });

  it("strips diacritics and tatweel", () => {
    assert.equal(normalizeArabic("مُحَادَثَـــة"), "محادثه");
  });

  it("converts Arabic-Indic digits to Western digits", () => {
    assert.equal(normalizeArabic("٢٤ ساعة"), "24 ساعه");
    assert.equal(normalizeArabic("۹ ريال"), "9 ريال");
  });

  it("turns punctuation into spaces and lower-cases Latin", () => {
    assert.equal(normalizeArabic("صندوق الوارد (Inbox)!"), "صندوق الوارد inbox");
  });
});

describe("stripDefiniteArticle", () => {
  it("removes ال when enough of the word remains", () => {
    assert.equal(stripDefiniteArticle("الحملات"), "حملات");
    assert.equal(stripDefiniteArticle("الواتساب"), "واتساب");
  });

  it("removes fused conjunction and preposition forms", () => {
    assert.equal(stripDefiniteArticle("والحملات"), "حملات");
    assert.equal(stripDefiniteArticle("بالواتساب"), "واتساب");
    assert.equal(stripDefiniteArticle("للحملات"), "حملات");
  });

  it("leaves short words alone", () => {
    assert.equal(stripDefiniteArticle("الم"), "الم");
    assert.equal(stripDefiniteArticle("الله"), "الله");
  });
});

describe("normalizeForSearch", () => {
  it("makes 'ربط الواتساب' match the title 'ربط واتساب بفلوفو' token for token", () => {
    const query = searchTokens("ربط الواتساب");
    const title = searchTokens("ربط واتساب بفلوفو");
    for (const token of query) assert.ok(title.includes(token), token);
  });

  it("makes 'الحملات' and 'حملات' identical", () => {
    assert.equal(normalizeForSearch("الحملات"), normalizeForSearch("حملات"));
  });

  it("is idempotent", () => {
    const once = normalizeForSearch("إرسال أوَّل حملة واتساب");
    assert.equal(normalizeForSearch(once), once);
  });
});
