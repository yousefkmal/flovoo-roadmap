"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import type { Dictionary } from "@/i18n";
import { geoScore, runGeoChecks, wordCount, SUMMARY_WORDS } from "@/lib/help/geo";
import type { TranslationDraft } from "@/lib/help/editor-draft";
import type { Locale } from "@/lib/types";

/**
 * How ready this translation is to be quoted by an assistant.
 *
 * Advisory on purpose. A writer with a reason should be able to ignore every
 * line of this; the only thing publishing actually enforces is that a summary
 * exists and is roughly the right length. The score is here to make the
 * invisible visible, not to gate anyone.
 */
export function GeoPanel({
  draft,
  locale,
  dict,
}: {
  draft: TranslationDraft;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.adminHelp;
  const checks = runGeoChecks({
    title: draft.title,
    answerSummary: draft.answer_summary || null,
    questionTitle: draft.question_title || null,
    keyFacts: draft.key_facts,
    body: draft.body,
    language: locale,
  });
  const score = geoScore(checks);
  const failed = checks.filter((c) => !c.passed);
  const words = draft.answer_summary ? wordCount(draft.answer_summary) : 0;

  const label: Record<string, string> = {
    "summary.present": t.geoSummaryPresent,
    "summary.length": t.geoSummaryLength,
    "heading.early": t.geoHeadingEarly,
    "heading.question": t.geoHeadingQuestion,
    "questionTitle.present": t.geoQuestionTitle,
    "paragraphs.short": t.geoParagraphsShort,
    "sections.selfContained": t.geoSelfContained,
    "steps.used": t.geoStepsUsed,
    "faq.present": t.geoFaqPresent,
    "keyFacts.whenNumbers": t.geoKeyFacts,
  };

  const tone =
    score >= 80 ? "text-success-label" : score >= 55 ? "text-warning-label" : "text-danger";

  return (
    <section className="rounded-card border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold text-text">{t.geoTitle}</h3>
        <span className={`numeral text-lg font-bold ${tone}`}>{score}</span>
      </div>
      <p className="mt-1 text-xs text-text-tertiary">{t.geoHint}</p>

      {draft.answer_summary ? (
        <p className="numeric mt-2 text-xs text-text-secondary">
          {t.geoSummaryWords.replace("{count}", String(words))}
          {words >= SUMMARY_WORDS.min && words <= SUMMARY_WORDS.max ? " ✓" : ""}
        </p>
      ) : null}

      <ul className="mt-3 flex flex-col gap-1.5">
        {failed.length === 0 ? (
          <li className="flex items-center gap-2 text-xs text-success-label">
            <CheckCircle2 className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
            {t.geoAllClear}
          </li>
        ) : (
          failed.map((check) => (
            <li key={check.id} className="flex items-start gap-2 text-xs text-text-secondary">
              {check.severity === "error" ? (
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" strokeWidth={2} aria-hidden />
              ) : (
                <Info className="mt-0.5 size-3.5 shrink-0 text-muted" strokeWidth={2} aria-hidden />
              )}
              {label[check.id] ?? check.id}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
