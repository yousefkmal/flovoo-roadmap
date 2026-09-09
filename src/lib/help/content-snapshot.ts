import type { BlockDocument, BlockNode } from "./blocks.ts";
import { nodeText, toPlainText } from "./blocks.ts";
import type { ContentSnapshot } from "./content-checks.ts";

/**
 * The help center's article shape, flattened into what the checks read.
 *
 * The blog keeps its own adapter — its bodies are HTML, not blocks — and both
 * feed the same `runContentChecks`. Everything here is a read: no dates are
 * invented, and a field the help center does not have (a focus keyword) is
 * left out rather than faked, so its check drops out of the score.
 */

function walk(node: BlockNode, visit: (node: BlockNode) => void): void {
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
}

export interface HelpSnapshotInput {
  language: "ar" | "en";
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  answerSummary: string | null;
  questionTitle: string | null;
  keyFacts: string[];
  body: BlockDocument;
  hasOtherLanguage: boolean;
  updatedAt: string | null;
  reviewDueAt: string | null;
}

export function helpContentSnapshot(input: HelpSnapshotInput): ContentSnapshot {
  const headings: { level: number; text: string }[] = [];
  const paragraphs: string[] = [];
  const images: { alt: string; altIsDraft: boolean }[] = [];
  let internalLinks = 0;
  let hasFaq = false;

  for (const block of input.body.content ?? []) {
    walk(block, (node) => {
      if (node.type === "heading") {
        headings.push({ level: Number(node.attrs?.level ?? 2), text: nodeText(node) });
      } else if (node.type === "paragraph") {
        const text = nodeText(node).trim();
        if (text) paragraphs.push(text);
      } else if (node.type === "figure") {
        images.push({
          alt: String(node.attrs?.alt ?? ""),
          altIsDraft: node.attrs?.altDraft === true,
        });
      } else if (node.type === "faq") {
        hasFaq = true;
      }
      // A link into our own help center, not out to a vendor's docs.
      for (const mark of node.marks ?? []) {
        if (mark.type !== "link") continue;
        const href = String(mark.attrs?.href ?? "");
        if (href.startsWith("/") || href.includes("help.flovoo.com")) internalLinks += 1;
      }
    });
  }

  return {
    language: input.language,
    title: input.title,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
    answerSummary: input.answerSummary,
    questionTitle: input.questionTitle,
    keyFacts: input.keyFacts,
    headings,
    paragraphs,
    plainText: toPlainText(input.body),
    images,
    internalLinks,
    hasFaq,
    hasOtherLanguage: input.hasOtherLanguage,
    updatedAt: input.updatedAt,
    reviewDueAt: input.reviewDueAt,
  };
}
