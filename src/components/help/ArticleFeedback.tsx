"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState, useSyncExternalStore, useTransition } from "react";

import { sendHelpFeedback, type FeedbackStatus } from "@/app/[locale]/help/actions";
import type { Locale } from "@/lib/types";

/**
 * "Was this helpful?" at the end of an article. Yes records at once; no asks
 * for an optional line about what was missing, which is what turns a thumbs
 * down into something the team can act on. The answer is remembered in this
 * browser so the question does not come back on every visit.
 */

export interface FeedbackLabels {
  title: string;
  yes: string;
  no: string;
  commentLabel: string;
  commentPlaceholder: string;
  send: string;
  skip: string;
  sending: string;
  thanks: string;
  failed: string;
  rateLimited: string;
}

type Stage = "ask" | "comment" | "done";

const STORAGE_PREFIX = "flovoo-help-feedback:";
const MAX_COMMENT = 1000;
/** Fired on this tab when an answer is remembered; `storage` only fires on others. */
const CHANGE_EVENT = "flovoo:help-feedback";

function remember(articleId: string) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${articleId}`, "1");
  } catch {
    // Storage may be unavailable; the answer still went through.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * Whether this browser already answered for the article, read as an external
 * store: the server snapshot is "no", so the question renders on the server
 * and the remembered "thanks" takes over on the client without a mismatch.
 */
function useRemembered(articleId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(`${STORAGE_PREFIX}${articleId}`) !== null;
      } catch {
        return false;
      }
    },
    () => false,
  );
}

export function ArticleFeedback({
  articleId,
  locale,
  labels,
}: {
  articleId: string;
  locale: Locale;
  labels: FeedbackLabels;
}) {
  const remembered = useRemembered(articleId);
  const [stageState, setStage] = useState<Stage>("ask");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const stage: Stage = remembered ? "done" : stageState;

  function submit(isHelpful: boolean, text: string | null) {
    setError(null);
    startTransition(async () => {
      const { status } = await sendHelpFeedback({
        articleId,
        locale,
        isHelpful,
        comment: text,
      });
      handle(status);
    });
  }

  function handle(status: FeedbackStatus) {
    if (status === "ok" || status === "duplicate") {
      remember(articleId);
      setStage("done");
      return;
    }
    setError(status === "rate_limited" ? labels.rateLimited : labels.failed);
  }

  return (
    <section
      aria-labelledby={`help-feedback-${articleId}`}
      className="rounded-card border border-border bg-card px-5 py-4"
    >
      {stage === "done" ? (
        <p role="status" className="text-sm font-medium text-text">
          {labels.thanks}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={`help-feedback-${articleId}`} className="text-sm font-semibold text-text">
              {labels.title}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => submit(true, null)}
                className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border bg-card px-3 text-sm font-semibold text-text transition-colors duration-(--dur-micro) hover:border-flovoo-blue/40 hover:text-link disabled:opacity-60"
              >
                <ThumbsUp className="size-4" strokeWidth={2} aria-hidden />
                {labels.yes}
              </button>
              <button
                type="button"
                disabled={pending}
                aria-expanded={stage === "comment"}
                onClick={() => setStage("comment")}
                className={`inline-flex h-9 items-center gap-1.5 rounded-control border px-3 text-sm font-semibold transition-colors duration-(--dur-micro) disabled:opacity-60 ${
                  stage === "comment"
                    ? "border-flovoo-blue bg-info-tint text-link"
                    : "border-border bg-card text-text hover:border-flovoo-blue/40 hover:text-link"
                }`}
              >
                <ThumbsDown className="size-4" strokeWidth={2} aria-hidden />
                {labels.no}
              </button>
            </div>
          </div>

          {stage === "comment" ? (
            <form
              className="mt-4 flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                submit(false, comment);
              }}
            >
              <label htmlFor={`help-feedback-comment-${articleId}`} className="text-sm font-medium text-text">
                {labels.commentLabel}
              </label>
              <textarea
                id={`help-feedback-comment-${articleId}`}
                value={comment}
                onChange={(event) => setComment(event.target.value.slice(0, MAX_COMMENT))}
                placeholder={labels.commentPlaceholder}
                rows={3}
                maxLength={MAX_COMMENT}
                className="w-full rounded-input border border-border bg-card px-3 py-2 text-sm text-text outline-none transition-colors duration-(--dur-micro) placeholder:text-placeholder focus:border-flovoo-blue"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-9 items-center rounded-control bg-brand-solid px-4 text-sm font-semibold text-brand-solid-text transition-opacity duration-(--dur-micro) hover:opacity-90 disabled:opacity-60"
                >
                  {pending ? labels.sending : labels.send}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => submit(false, null)}
                  className="inline-flex h-9 items-center rounded-control px-3 text-sm font-semibold text-text-secondary transition-colors duration-(--dur-micro) hover:text-text disabled:opacity-60"
                >
                  {labels.skip}
                </button>
              </div>
            </form>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
