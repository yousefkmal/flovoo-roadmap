import { randomUUID } from "node:crypto";

import { deriveArticleMeta, type BlockDocument } from "./blocks.ts";
import type { HelpArticleTranslation } from "./types.ts";
import type { Locale } from "../types.ts";

export interface HelpTranslationInput {
  slug: string;
  title: string;
  excerpt: string | null;
  body: BlockDocument;
  meta_title: string | null;
  meta_description: string | null;
  /** Phase 7B: the extraction fields. */
  answer_summary: string | null;
  /** The editor says the writer has read the drafted summary and accepts it. */
  summary_reviewed: boolean;
  question_title: string | null;
  key_facts: string[];
  review_due_at: string | null;
}

/**
 * The stored shape of one translation — the single list of what a save writes.
 *
 * It lives on its own because there used to be two of these: this builder, and
 * a second column list inlined in the Supabase upsert. The two drifted, and the
 * inlined one silently dropped `answer_summary`, `question_title`, `key_facts`
 * and `summary_needs_review` — four fields a writer could type, save, and lose
 * with no error anywhere. One builder now serves both backends, and the review
 * flag it computes is pinned by the tests next to this file.
 */
export function translationRow(
  articleId: string,
  language: Locale,
  input: HelpTranslationInput,
  existing: HelpArticleTranslation | undefined,
  now: string,
): HelpArticleTranslation {
  return {
    id: existing?.id ?? randomUUID(),
    article_id: articleId,
    language,
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt,
    answer_summary: input.answer_summary,
    // Two ways to review a drafted summary: rewrite it, or press approve. The
    // text comparison is the one that cannot be forged by a stale client.
    summary_needs_review:
      (existing?.summary_needs_review ?? false) &&
      !input.summary_reviewed &&
      input.answer_summary === (existing?.answer_summary ?? null),
    question_title: input.question_title,
    key_facts: input.key_facts,
    // Six months from now unless the writer set a date themselves.
    review_due_at:
      input.review_due_at ??
      existing?.review_due_at ??
      new Date(Date.parse(now) + 182 * 24 * 60 * 60 * 1000).toISOString(),
    body: input.body,
    meta_title: input.meta_title,
    meta_description: input.meta_description,
    og_image_path: existing?.og_image_path ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    ...deriveArticleMeta(input.body),
  };
}
