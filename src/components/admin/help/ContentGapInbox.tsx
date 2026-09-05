"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquareWarning, PenLine, SearchX, X } from "lucide-react";
import { useTransition } from "react";

import { dismissContentGapAction } from "@/app/[locale]/admin/help/actions";
import { EmptyState } from "@/components/ui/EmptyState";
import { t, type Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

export interface GapQueryItem {
  query: string;
  language: Locale;
  searches: number;
  lastSeenLabel: string;
}

export interface GapFeedbackItem {
  id: string;
  articleTitle: string;
  articleHref: string;
  language: Locale;
  comment: string | null;
  createdLabel: string;
}

/**
 * The content-gap inbox (brief §4, §9): questions that returned nothing, and
 * articles somebody marked unhelpful. Each item can be dismissed, or turned
 * into a draft — which opens the editor with the question already in the
 * title, because the question is usually the better headline.
 */
export function ContentGapInbox({
  queries,
  feedback,
  locale,
  dict,
}: {
  queries: GapQueryItem[];
  feedback: GapFeedbackItem[];
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const a = dict.adminHelp;

  function dismiss(kind: "query" | "feedback", ref: string) {
    startTransition(async () => {
      await dismissContentGapAction(locale, kind, ref);
      router.refresh();
    });
  }

  if (queries.length === 0 && feedback.length === 0) {
    return <EmptyState className="mt-6" title={a.gapEmpty} body={a.gapEmptyBody} />;
  }

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <section aria-labelledby="gap-queries" className="overflow-hidden rounded-card border border-border bg-card">
        <h2 id="gap-queries" className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-bold text-text">
          <SearchX className="size-4 text-warning-label" strokeWidth={2} aria-hidden />
          {a.gapQueriesTitle}
        </h2>
        {queries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-text-tertiary">{a.gapNoQueries}</p>
        ) : (
          <ul className="divide-y divide-border">
            {queries.map((item) => (
              <li key={`${item.query}-${item.language}`} className="flex items-start gap-2 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-text">{item.query}</span>
                  <span className="numeric block text-xs text-text-tertiary">
                    {t(a.gapSearchedTimes, { count: item.searches })} · {item.lastSeenLabel} ·{" "}
                    {item.language === "ar" ? "ع" : "EN"}
                  </span>
                </span>
                <Link
                  href={`/${locale}/admin/help/articles/new?title=${encodeURIComponent(item.query)}&lang=${item.language}`}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control bg-brand-solid px-2.5 text-xs font-semibold text-brand-solid-text hover:opacity-90"
                >
                  <PenLine className="size-3.5" strokeWidth={2} aria-hidden />
                  {a.gapCreateDraft}
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => dismiss("query", item.query)}
                  aria-label={t(a.gapDismiss, { item: item.query })}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-input text-muted hover:bg-subtle hover:text-text disabled:opacity-40"
                >
                  <X className="size-4" strokeWidth={2} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="gap-feedback" className="overflow-hidden rounded-card border border-border bg-card">
        <h2 id="gap-feedback" className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-bold text-text">
          <MessageSquareWarning className="size-4 text-danger" strokeWidth={2} aria-hidden />
          {a.gapFeedbackTitle}
        </h2>
        {feedback.length === 0 ? (
          <p className="px-4 py-6 text-sm text-text-tertiary">{a.gapNoFeedback}</p>
        ) : (
          <ul className="divide-y divide-border">
            {feedback.map((item) => (
              <li key={item.id} className="flex items-start gap-2 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <Link href={item.articleHref} className="block truncate text-sm font-semibold text-text hover:text-link">
                    {item.articleTitle}
                  </Link>
                  {item.comment ? (
                    <span className="mt-0.5 block text-sm text-text-secondary">“{item.comment}”</span>
                  ) : (
                    <span className="mt-0.5 block text-sm italic text-text-tertiary">{a.gapNoComment}</span>
                  )}
                  <span className="numeric block text-xs text-text-tertiary">
                    {item.createdLabel} · {item.language === "ar" ? "ع" : "EN"}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => dismiss("feedback", item.id)}
                  aria-label={t(a.gapDismiss, { item: item.articleTitle })}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-input text-muted hover:bg-subtle hover:text-text disabled:opacity-40"
                >
                  <X className="size-4" strokeWidth={2} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
