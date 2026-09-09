"use client";

import { AlertTriangle, Check, Minus, X } from "lucide-react";

import type { Dictionary } from "@/i18n";
import { contentScore, runContentChecks, wordCount, SUMMARY_WORDS } from "@/lib/help/content-checks";
import { helpContentSnapshot } from "@/lib/help/content-snapshot";
import type { TranslationDraft } from "@/lib/help/editor-draft";
import type { Locale } from "@/lib/types";

/**
 * Everything this translation is missing, for search and for assistants, in
 * one panel and one number.
 *
 * It recomputes on every keystroke, which is why the checks are pure and touch
 * neither the database nor the network. Every line shows its state — done, not
 * done, or not applicable — because a checklist that hides what passed reads
 * like a list of complaints rather than a picture of where the article stands.
 *
 * Advisory throughout. The one thing publishing still refuses is an image with
 * no alt text.
 */

const GROUPS: { key: string; label: (t: Dictionary["checks"]) => string; ids: string[] }[] = [
  {
    key: "answer",
    label: (t) => t.grpAnswer,
    ids: ["summary.present", "summary.length", "questionTitle.present", "keyFacts.whenNumbers", "faq.present"],
  },
  {
    key: "search",
    label: (t) => t.grpSearch,
    ids: ["meta.title", "meta.description", "keyword.placement"],
  },
  {
    key: "structure",
    label: (t) => t.grpStructure,
    ids: ["paragraphs.short", "heading.early", "sections.selfContained", "headings.enough", "headings.order"],
  },
  { key: "images", label: (t) => t.grpImages, ids: ["images.alt", "images.altReviewed"] },
  {
    key: "links",
    label: (t) => t.grpLinks,
    ids: ["translation.other", "links.internal", "freshness.updated", "review.due"],
  },
];

function copyFor(t: Dictionary["checks"], id: string): { label: string; fix: string } {
  const map: Record<string, [string, string]> = {
    "summary.present": [t.summaryPresent, t.summaryPresentFix],
    "summary.length": [t.summaryLength, t.summaryLengthFix],
    "questionTitle.present": [t.questionTitle, t.questionTitleFix],
    "keyFacts.whenNumbers": [t.keyFacts, t.keyFactsFix],
    "faq.present": [t.faq, t.faqFix],
    "meta.title": [t.metaTitle, t.metaTitleFix],
    "meta.description": [t.metaDescription, t.metaDescriptionFix],
    "keyword.placement": [t.keyword, t.keywordFix],
    "paragraphs.short": [t.paragraphs, t.paragraphsFix],
    "heading.early": [t.headingEarly, t.headingEarlyFix],
    "sections.selfContained": [t.selfContained, t.selfContainedFix],
    "headings.enough": [t.headingsEnough, t.headingsEnoughFix],
    "headings.order": [t.headingsOrder, t.headingsOrderFix],
    "images.alt": [t.imagesAlt, t.imagesAltFix],
    "images.altReviewed": [t.imagesAltReviewed, t.imagesAltReviewedFix],
    "translation.other": [t.translationOther, t.translationOtherFix],
    "links.internal": [t.linksInternal, t.linksInternalFix],
    "freshness.updated": [t.freshness, t.freshnessFix],
    "review.due": [t.reviewDue, t.reviewDueFix],
  };
  const [label, fix] = map[id] ?? [id, ""];
  return { label, fix };
}

export function ReadinessPanel({
  draft,
  locale,
  dict,
  hasOtherLanguage,
  updatedAt,
  reviewDueAt,
}: {
  draft: TranslationDraft;
  locale: Locale;
  dict: Dictionary;
  hasOtherLanguage: boolean;
  updatedAt: string | null;
  reviewDueAt: string | null;
}) {
  const t = dict.checks;
  const checks = runContentChecks(
    helpContentSnapshot({
      language: locale,
      title: draft.title,
      metaTitle: draft.meta_title || null,
      metaDescription: draft.meta_description || null,
      answerSummary: draft.answer_summary || null,
      questionTitle: draft.question_title || null,
      keyFacts: draft.key_facts,
      body: draft.body,
      hasOtherLanguage,
      updatedAt,
      reviewDueAt,
    }),
  );
  const byId = new Map(checks.map((check) => [check.id, check]));
  const score = contentScore(checks);
  const words = draft.answer_summary ? wordCount(draft.answer_summary) : 0;
  const tone = score >= 80 ? "text-success-label" : score >= 55 ? "text-warning-label" : "text-danger";

  return (
    <section className="rounded-card border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold text-text">{t.panelTitle}</h3>
        <span className={`numeral text-lg font-bold ${tone}`}>{score}</span>
      </div>
      <p className="mt-1 text-xs text-text-tertiary">{t.panelHint}</p>

      {draft.answer_summary ? (
        <p className="numeric mt-2 text-xs text-text-secondary">
          {t.summaryWords.replace("{count}", String(words))}
          {words >= SUMMARY_WORDS.min && words <= SUMMARY_WORDS.max ? " ✓" : ""}
        </p>
      ) : null}

      {checks.every((check) => check.passed !== false) ? (
        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-success-label">
          <Check className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
          {t.allClear}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-3">
        {GROUPS.map((group) => (
          <div key={group.key}>
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-text-tertiary">
              {group.label(t)}
            </h4>
            <ul className="mt-1 flex flex-col gap-1">
              {group.ids.map((id) => {
                const check = byId.get(id);
                if (!check) return null;
                const { label, fix } = copyFor(t, id);
                const failed = check.passed === false;
                const skipped = check.passed === null;
                return (
                  <li key={id} className="flex items-start gap-2 text-xs">
                    {skipped ? (
                      <Minus className="mt-0.5 size-3.5 shrink-0 text-muted" strokeWidth={2} aria-hidden />
                    ) : failed ? (
                      check.severity === "error" ? (
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" strokeWidth={2} aria-hidden />
                      ) : (
                        <X className="mt-0.5 size-3.5 shrink-0 text-warning-label" strokeWidth={2.5} aria-hidden />
                      )
                    ) : (
                      <Check className="mt-0.5 size-3.5 shrink-0 text-success-label" strokeWidth={2.5} aria-hidden />
                    )}
                    <span className="min-w-0">
                      <span className={skipped ? "text-text-tertiary" : "text-text-secondary"}>{label}</span>
                      {skipped ? (
                        <span className="text-text-tertiary"> · {t.notApplicable}</span>
                      ) : null}
                      {/* The instruction appears only where it is needed. */}
                      {failed ? <span className="block text-text-tertiary">{fix}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
