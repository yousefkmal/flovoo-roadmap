/**
 * How ready one translation is — for search and for assistants, in one score.
 *
 * Two rules govern everything here.
 *
 * **It advises, it never blocks.** A writer with a reason should be able to
 * ignore every line of it. The only thing publishing refuses is an image with
 * no alt text, because that one has a reader on the other end who cannot see
 * the picture. The score exists to make the invisible visible.
 *
 * **A check that does not apply leaves the sum.** An article with no images is
 * not punished for having no alt text, and an article that states no numbers
 * is not punished for having no key facts: those checks drop out of the score
 * and out of its denominator, so 100 always means "nothing left that applies".
 *
 * Weights are not equal — they are the estate's own judgement of what moves
 * the needle. The direct answer alone carries 14 of the 100 because it is the
 * passage a retrieval system reads and quotes; "at least two subheadings"
 * carries 3 because it is editing manners, not reach.
 *
 * Dependency-free on purpose: the blog runs the same file, and the two estates
 * hand it a snapshot each builds for itself.
 */

export type CheckSeverity = "error" | "warning" | "hint";

export interface ContentCheck {
  id: string;
  severity: CheckSeverity;
  /** Null when the check does not apply to this article at all. */
  passed: boolean | null;
  weight: number;
}

/** What both estates flatten their very different article shapes into. */
export interface ContentSnapshot {
  language: "ar" | "en";
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  answerSummary: string | null;
  questionTitle: string | null;
  keyFacts: string[];
  /** Blog only. Null or absent means the check does not apply. */
  focusKeyword?: string | null;
  /** In document order. */
  headings: { level: number; text: string }[];
  /** In document order, plain text. */
  paragraphs: string[];
  /** The whole body as plain text. */
  plainText: string;
  images: { alt: string; altIsDraft: boolean }[];
  /** Links pointing at our own content, not outward. */
  internalLinks: number;
  hasFaq: boolean;
  /** Whether the article exists in the other language. */
  hasOtherLanguage: boolean;
  /** ISO date, or null when unknown. */
  updatedAt: string | null;
  /** Help center only. Absent means the check does not apply. */
  reviewDueAt?: string | null;
}

export const SUMMARY_WORDS = { min: 40, max: 70 } as const;
export const META_TITLE_MAX = 60;
export const META_DESCRIPTION = { min: 80, max: 160 } as const;
export const MIN_INTERNAL_LINKS = 2;
const FRESH_MONTHS = 12;

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Arabic and Latin sentence enders, counted the same way. */
export function sentenceCount(text: string): number {
  const parts = text
    .split(/[.!?؟।]+|۔/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length || (text.trim() ? 1 : 0);
}

/**
 * Words that make a passage lean on the one before it. A section opening with
 * "as we saw above" cannot be lifted out and quoted on its own.
 */
const REFERRING_OPENERS: Record<"ar" | "en", string[]> = {
  ar: ["كما", "وكما", "هذه", "هذا", "ذلك", "تلك", "وبالتالي", "لذلك", "وهكذا", "أيضًا", "أيضا"],
  en: ["this", "that", "these", "those", "therefore", "thus", "so", "also", "additionally", "however"],
};

export function startsWithReference(text: string, language: "ar" | "en"): boolean {
  const first = text.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^\p{L}]/gu, "") ?? "";
  if (!first) return false;
  return REFERRING_OPENERS[language].some((opener) => first === opener.toLowerCase());
}

/** Does the article state a number, a limit or a price? Then it needs key facts. */
export function mentionsFigures(plain: string): boolean {
  return /\d|[٠-٩]/.test(plain);
}

function monthsSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return (Date.now() - then) / (1000 * 60 * 60 * 24 * 30.4);
}

/** Is the keyword in the title, or in the opening paragraph? */
function keywordPlaced(snapshot: ContentSnapshot): boolean {
  const keyword = snapshot.focusKeyword?.trim().toLowerCase();
  if (!keyword) return false;
  const opening = (snapshot.paragraphs[0] ?? "").toLowerCase();
  return snapshot.title.toLowerCase().includes(keyword) || opening.includes(keyword);
}

export function runContentChecks(snapshot: ContentSnapshot): ContentCheck[] {
  const check = (
    id: string,
    severity: CheckSeverity,
    passed: boolean | null,
    weight: number,
  ): ContentCheck => ({ id, severity, passed, weight });

  const summaryWords = snapshot.answerSummary ? wordCount(snapshot.answerSummary) : 0;
  const h2s = snapshot.headings.filter((h) => h.level === 2);
  const firstH2 = snapshot.headings.findIndex((h) => h.level === 2);
  const firstH3 = snapshot.headings.findIndex((h) => h.level === 3);
  const longParagraphs = snapshot.paragraphs.filter((p) => sentenceCount(p) > 4).length;

  // A heading whose first paragraph points backwards cannot stand alone.
  const dependent = snapshot.headings.filter((_, index) => {
    const paragraph = snapshot.paragraphs[index];
    return paragraph ? startsWithReference(paragraph, snapshot.language) : false;
  }).length;

  const hasImages = snapshot.images.length > 0;
  const months = monthsSince(snapshot.updatedAt);
  const metaTitle = snapshot.metaTitle?.trim() ?? "";
  const metaDescription = snapshot.metaDescription?.trim() ?? "";

  return [
    // The answer, and what can be lifted out of the article — 34
    check("summary.present", "error", Boolean(snapshot.answerSummary?.trim()), 14),
    check(
      "summary.length",
      "warning",
      snapshot.answerSummary?.trim()
        ? summaryWords >= SUMMARY_WORDS.min && summaryWords <= SUMMARY_WORDS.max
        : null,
      6,
    ),
    check("questionTitle.present", "warning", Boolean(snapshot.questionTitle?.trim()), 6),
    check(
      "keyFacts.whenNumbers",
      "warning",
      mentionsFigures(snapshot.plainText) ? snapshot.keyFacts.length >= 3 : null,
      5,
    ),
    check("faq.present", "hint", snapshot.hasFaq, 3),

    // What a search result shows — 18
    check("meta.title", "warning", Boolean(metaTitle) && metaTitle.length <= META_TITLE_MAX, 7),
    check(
      "meta.description",
      "warning",
      Boolean(metaDescription) &&
        metaDescription.length >= META_DESCRIPTION.min &&
        metaDescription.length <= META_DESCRIPTION.max,
      7,
    ),
    check(
      "keyword.placement",
      "warning",
      snapshot.focusKeyword?.trim() ? keywordPlaced(snapshot) : null,
      4,
    ),

    // Structure and readability — 20
    check("paragraphs.short", "warning", snapshot.paragraphs.length ? longParagraphs === 0 : null, 5),
    check("heading.early", "warning", firstH2 !== -1 && firstH2 <= 1, 5),
    check("sections.selfContained", "warning", snapshot.headings.length ? dependent === 0 : null, 4),
    check("headings.enough", "hint", h2s.length >= 2, 3),
    check("headings.order", "warning", firstH3 === -1 || (firstH2 !== -1 && firstH2 < firstH3), 3),

    // Images — 12
    check("images.alt", "error", hasImages ? snapshot.images.every((i) => i.alt.trim()) : null, 8),
    check(
      "images.altReviewed",
      "warning",
      hasImages ? snapshot.images.every((i) => !i.altIsDraft) : null,
      4,
    ),

    // Links, freshness, the other language — 16
    check("translation.other", "warning", snapshot.hasOtherLanguage, 6),
    check("links.internal", "warning", snapshot.internalLinks >= MIN_INTERNAL_LINKS, 5),
    check("freshness.updated", "hint", months === null ? null : months <= FRESH_MONTHS, 3),
    check(
      "review.due",
      "hint",
      snapshot.reviewDueAt ? Date.parse(snapshot.reviewDueAt) >= Date.now() : null,
      2,
    ),
  ];
}

/** 0–100 over the checks that apply. Advisory: nothing is blocked by a low score. */
export function contentScore(checks: ContentCheck[]): number {
  const applicable = checks.filter((c) => c.passed !== null);
  const total = applicable.reduce((sum, c) => sum + c.weight, 0);
  if (!total) return 100;
  const earned = applicable.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
  return Math.round((earned / total) * 100);
}
