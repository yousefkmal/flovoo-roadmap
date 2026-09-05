"use server";

import { headers } from "next/headers";

import { isLocale } from "@/i18n/config";
import {
  HelpRateLimited,
  MAX_FEEDBACK_COMMENT,
  submitHelpFeedback,
} from "@/lib/data/help-mutations";
import { visitorHashFrom } from "@/lib/help/request";

/**
 * Public Server Actions for the help center. Anonymous by design — asking a
 * reader to sign in before saying "this did not help" would lose the answer.
 * Input is re-validated here; the widget's own checks are for instant feedback
 * and are trivially bypassed.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FeedbackStatus = "ok" | "duplicate" | "rate_limited" | "invalid" | "error";

export async function sendHelpFeedback(input: {
  articleId: string;
  locale: string;
  isHelpful: boolean;
  comment: string | null;
}): Promise<{ status: FeedbackStatus }> {
  if (!UUID.test(input.articleId) || !isLocale(input.locale)) return { status: "invalid" };
  const comment = input.comment?.trim() || null;
  if (comment && comment.length > MAX_FEEDBACK_COMMENT) return { status: "invalid" };

  try {
    const outcome = await submitHelpFeedback({
      articleId: input.articleId,
      locale: input.locale,
      isHelpful: Boolean(input.isHelpful),
      comment,
      visitorHash: visitorHashFrom(await headers()),
    });
    return { status: outcome === "saved" ? "ok" : "duplicate" };
  } catch (error) {
    if (error instanceof HelpRateLimited) return { status: "rate_limited" };
    console.error("help feedback failed", error);
    return { status: "error" };
  }
}
