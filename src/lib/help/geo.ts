import { countNodes, nodeText, toPlainText, type BlockDocument, type BlockNode } from "./blocks.ts";

/**
 * How ready a translation is to be quoted by an assistant.
 *
 * Every check here is advisory. The editor shows them as warnings, never as
 * blockers, because a writer with a good reason should win against a rule of
 * thumb — the one exception is `answer_summary`, which publishing does require
 * (Phase 7B), since it is the paragraph a retrieval system reads first.
 *
 * Pure: the editor runs this on every keystroke and the article list runs it
 * per row, so it must not touch the database or the network.
 */

export interface GeoInput {
  title: string;
  answerSummary: string | null;
  questionTitle: string | null;
  keyFacts: string[];
  body: BlockDocument;
  language: "ar" | "en";
}

export type GeoSeverity = "error" | "warning" | "hint";

export interface GeoCheck {
  id: string;
  severity: GeoSeverity;
  /** Whether the article currently satisfies this check. */
  passed: boolean;
  /** Weight in the score. Errors weigh most. */
  weight: number;
}

/** 40–70 words is the target; the range either side is tolerated. */
export const SUMMARY_WORDS = { min: 40, max: 70, hardMin: 25, hardMax: 110 } as const;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Sentence count that works for both scripts, including Arabic punctuation. */
export function sentenceCount(text: string): number {
  return text
    .split(/[.!?؟।۔]+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

/**
 * A paragraph opening with one of these depends on what came before it, so it
 * cannot stand alone as an extracted answer.
 */
const REFERRING_OPENERS: Record<"ar" | "en", string[]> = {
  ar: ["كذلك", "أيضًا", "ايضا", "كما ذكرنا", "وكما", "بعد ذلك", "ثم", "هنا", "هذه الخطوة", "بالإضافة"],
  en: ["also", "as mentioned", "as above", "then", "next", "this step", "additionally", "furthermore", "it"],
};

export function startsWithReference(text: string, language: "ar" | "en"): boolean {
  const first = text.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^\p{L}]/gu, "") ?? "";
  if (!first) return false;
  return REFERRING_OPENERS[language].some((opener) => first === opener.toLowerCase());
}

/** Does the article state a number, a limit or a price? Then it needs key facts. */
export function mentionsFigures(plain: string): boolean {
  return /\d/.test(plain);
}

const QUESTION_MARKS = /[?؟]/;

export function runGeoChecks(input: GeoInput): GeoCheck[] {
  const plain = toPlainText(input.body);
  const blocks = input.body.content ?? [];
  const headings = blocks.filter((b) => b.type === "heading");
  const summaryWords = input.answerSummary ? wordCount(input.answerSummary) : 0;

  const paragraphs = blocks.filter((b) => b.type === "paragraph");
  const longParagraphs = paragraphs.filter((p) => sentenceCount(nodeText(p)) > 4).length;

  // Each H2 should open a passage that stands on its own.
  const dependentSections = blocks.filter((block, index) => {
    if (block.type !== "heading") return false;
    const next = blocks[index + 1];
    return next?.type === "paragraph" && startsWithReference(nodeText(next), input.language);
  }).length;

  const check = (id: string, severity: GeoSeverity, passed: boolean, weight: number): GeoCheck => ({
    id,
    severity,
    passed,
    weight,
  });

  return [
    check("summary.present", "error", Boolean(input.answerSummary?.trim()), 30),
    check(
      "summary.length",
      "warning",
      summaryWords >= SUMMARY_WORDS.min && summaryWords <= SUMMARY_WORDS.max,
      12,
    ),
    check("heading.early", "warning", headings.length > 0 && blocks.indexOf(headings[0]) <= 4, 10),
    check("heading.question", "hint", headings.some((h) => QUESTION_MARKS.test(nodeText(h))), 6),
    check("questionTitle.present", "hint", Boolean(input.questionTitle?.trim()), 8),
    check("paragraphs.short", "warning", longParagraphs === 0, 10),
    check("sections.selfContained", "warning", dependentSections === 0, 10),
    check(
      "steps.used",
      "hint",
      countNodes(input.body, "steps") > 0 || countNodes(input.body, "orderedList") > 0,
      4,
    ),
    check("faq.present", "hint", countNodes(input.body, "faq") > 0, 6),
    check(
      "keyFacts.whenNumbers",
      "warning",
      !mentionsFigures(plain) || input.keyFacts.length >= 3,
      4,
    ),
  ];
}

/** 0–100. Advisory only: nothing is blocked by a low score. */
export function geoScore(checks: GeoCheck[]): number {
  const total = checks.reduce((sum, c) => sum + c.weight, 0);
  if (!total) return 0;
  const earned = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
  return Math.round((earned / total) * 100);
}

/** The one check publishing enforces. */
export function summaryBlocksPublish(answerSummary: string | null | undefined): boolean {
  const words = answerSummary ? wordCount(answerSummary) : 0;
  return words < SUMMARY_WORDS.hardMin || words > SUMMARY_WORDS.hardMax;
}

export function firstBlockIsHeading(body: BlockDocument): BlockNode | null {
  return (body.content ?? []).find((b) => b.type === "heading") ?? null;
}
