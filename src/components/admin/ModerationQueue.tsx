"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { Check, GitMerge, Search, X } from "lucide-react";

import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FIELD_CLASS, Field } from "@/components/ui/Field";
import {
  approveSubmissionAction,
  mergeSubmissionAction,
  rejectSubmissionAction,
  type ModerationState,
} from "@/app/[locale]/admin/actions";
import { t, type Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { FEATURE_STATUSES, type FeatureStatus } from "@/lib/types";

export interface QueueSubmission {
  id: string;
  title: string;
  description: string | null;
  submitterName: string;
  submitterEmail: string;
  language: "ar" | "en";
  categoryId: string | null;
  dateLabel: string;
}

export interface MergeTarget {
  id: string;
  title: string;
  statusLabel: string;
}

export interface QueueCategory {
  id: string;
  name: string;
}

/**
 * The moderation queue.
 *
 * Three outcomes, and each is a different amount of work: rejecting is one
 * note, merging is one search, approving is a small translation job. The row
 * offers all three and the dialog behind each only asks for what that outcome
 * actually needs.
 */
export function ModerationQueue({
  submissions,
  categories,
  mergeTargets,
  locale,
  dict,
}: {
  submissions: QueueSubmission[];
  categories: QueueCategory[];
  mergeTargets: MergeTarget[];
  locale: Locale;
  dict: Dictionary;
}) {
  const [active, setActive] = useState<{
    submission: QueueSubmission;
    mode: "approve" | "merge" | "reject";
  } | null>(null);

  if (submissions.length === 0) {
    return (
      <EmptyState
        className="mt-8"
        title={dict.admin.queueEmpty}
        body={dict.admin.queueEmptyBody}
      />
    );
  }

  return (
    <>
      <ul className="mt-6 flex flex-col gap-3">
        {submissions.map((submission) => (
          <li
            key={submission.id}
            className="rounded-control border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2
                  dir={submission.language === "ar" ? "rtl" : "ltr"}
                  lang={submission.language}
                  className="text-sm font-semibold text-text"
                >
                  {submission.title}
                </h2>
                {submission.description ? (
                  <p
                    dir={submission.language === "ar" ? "rtl" : "ltr"}
                    lang={submission.language}
                    className="mt-1.5 text-sm text-text-secondary"
                  >
                    {submission.description}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-text-tertiary">
                  {t(dict.admin.submittedBy, { name: submission.submitterName })}
                  {" · "}
                  <span dir="ltr">{submission.submitterEmail}</span>
                  {" · "}
                  <span className="numeric">{submission.dateLabel}</span>
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActive({ submission, mode: "approve" })}
                  className="inline-flex h-9 items-center gap-1.5 rounded-control bg-brand-solid px-3 text-sm font-semibold text-brand-solid-text"
                >
                  <Check className="size-4" strokeWidth={2} aria-hidden />
                  {dict.admin.approve}
                </button>
                <button
                  type="button"
                  onClick={() => setActive({ submission, mode: "merge" })}
                  className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border px-3 text-sm font-semibold text-text-secondary transition-colors duration-(--dur-micro) hover:text-text"
                >
                  <GitMerge className="size-4" strokeWidth={2} aria-hidden />
                  {dict.admin.merge}
                </button>
                <button
                  type="button"
                  onClick={() => setActive({ submission, mode: "reject" })}
                  className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border px-3 text-sm font-semibold text-text-secondary transition-colors duration-(--dur-micro) hover:border-danger hover:text-danger"
                >
                  <X className="size-4" strokeWidth={2} aria-hidden />
                  {dict.admin.reject}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {active?.mode === "approve" ? (
        <ApproveDialog
          submission={active.submission}
          categories={categories}
          locale={locale}
          dict={dict}
          onClose={() => setActive(null)}
        />
      ) : null}

      {active?.mode === "merge" ? (
        <MergeDialog
          submission={active.submission}
          targets={mergeTargets}
          locale={locale}
          dict={dict}
          onClose={() => setActive(null)}
        />
      ) : null}

      {active?.mode === "reject" ? (
        <RejectDialog
          submission={active.submission}
          locale={locale}
          dict={dict}
          onClose={() => setActive(null)}
        />
      ) : null}
    </>
  );
}

function ApproveDialog({
  submission,
  categories,
  locale,
  dict,
  onClose,
}: {
  submission: QueueSubmission;
  categories: QueueCategory[];
  locale: Locale;
  dict: Dictionary;
  onClose: () => void;
}) {
  const firstRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState<ModerationState, FormData>(
    async (prev, formData) => {
      const result = await approveSubmissionAction(locale, submission.id, prev, formData);
      if (result.status === "approved") onClose();
      return result;
    },
    { status: "idle" },
  );

  const errors = state.status === "invalid" ? state.errors : {};
  // The submission arrived in one language; that side is prefilled and the
  // other is the admin's job.
  const arrivedInArabic = submission.language === "ar";

  return (
    <Dialog
      open
      label={dict.admin.approveTitle}
      onClose={onClose}
      containerClassName="max-w-2xl"
      initialFocusRef={firstRef}
    >
      <form action={formAction} className="flex flex-col gap-5 p-6">
        <div>
          <h2 className="text-lg font-bold text-text">{dict.admin.approveTitle}</h2>
          <p className="mt-1 text-sm text-text-secondary">{dict.admin.approveHint}</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field
            id="approve-title-ar"
            label={dict.admin.fieldTitleAr}
            error={errors.title_ar ? dict.fieldError[errors.title_ar] : undefined}
          >
            <input
              ref={arrivedInArabic ? undefined : firstRef}
              id="approve-title-ar"
              name="title_ar"
              dir="rtl"
              lang="ar"
              required
              defaultValue={arrivedInArabic ? submission.title : ""}
              aria-invalid={Boolean(errors.title_ar)}
              className={`${FIELD_CLASS} text-start`}
            />
          </Field>

          <Field
            id="approve-title-en"
            label={dict.admin.fieldTitleEn}
            error={errors.title_en ? dict.fieldError[errors.title_en] : undefined}
          >
            <input
              ref={arrivedInArabic ? firstRef : undefined}
              id="approve-title-en"
              name="title_en"
              dir="ltr"
              lang="en"
              required
              defaultValue={arrivedInArabic ? "" : submission.title}
              aria-invalid={Boolean(errors.title_en)}
              className={`${FIELD_CLASS} text-start`}
            />
          </Field>

          <Field id="approve-desc-ar" label={dict.admin.fieldDescriptionAr}>
            <textarea
              id="approve-desc-ar"
              name="description_ar"
              dir="rtl"
              lang="ar"
              rows={3}
              defaultValue={arrivedInArabic ? (submission.description ?? "") : ""}
              className={`${FIELD_CLASS} resize-y text-start`}
            />
          </Field>

          <Field id="approve-desc-en" label={dict.admin.fieldDescriptionEn}>
            <textarea
              id="approve-desc-en"
              name="description_en"
              dir="ltr"
              lang="en"
              rows={3}
              defaultValue={arrivedInArabic ? "" : (submission.description ?? "")}
              className={`${FIELD_CLASS} resize-y text-start`}
            />
          </Field>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field id="approve-status" label={dict.admin.fieldStatus}>
            <select
              id="approve-status"
              name="status"
              defaultValue="under_review"
              className={FIELD_CLASS}
            >
              {FEATURE_STATUSES.filter((s) => s !== "archived").map((status) => (
                <option key={status} value={status}>
                  {dict.status[status as FeatureStatus]}
                </option>
              ))}
            </select>
          </Field>

          <Field id="approve-category" label={dict.admin.fieldCategory}>
            <select
              id="approve-category"
              name="category_id"
              defaultValue={submission.categoryId ?? ""}
              className={FIELD_CLASS}
            >
              <option value="">{dict.admin.fieldCategoryNone}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {state.status === "error" ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {dict.admin.saveFailed}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-control border border-border px-4 text-sm font-semibold text-text-secondary"
          >
            {dict.admin.cancel}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center gap-2 rounded-control bg-brand-solid px-4 text-sm font-semibold text-brand-solid-text disabled:opacity-70"
          >
            <Check className="size-4" strokeWidth={2} aria-hidden />
            {pending ? dict.admin.saving : dict.admin.approve}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function MergeDialog({
  submission,
  targets,
  locale,
  dict,
  onClose,
}: {
  submission: QueueSubmission;
  targets: MergeTarget[];
  locale: Locale;
  dict: Dictionary;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return targets.slice(0, 8);
    return targets.filter((tg) => tg.title.toLowerCase().includes(needle)).slice(0, 8);
  }, [targets, query]);

  return (
    <Dialog
      open
      label={dict.admin.mergeTitle}
      onClose={onClose}
      containerClassName="max-w-lg"
      initialFocusRef={searchRef}
    >
      <div className="flex flex-col gap-5 p-6">
        <div>
          <h2 className="text-lg font-bold text-text">{dict.admin.mergeTitle}</h2>
          <p className="mt-1 text-sm text-text-secondary">{dict.admin.mergeHint}</p>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted"
            strokeWidth={2}
            aria-hidden
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={dict.admin.mergeSearch}
            aria-label={dict.admin.mergeSearch}
            className={`${FIELD_CLASS} ps-9`}
          />
        </div>

        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {matches.length === 0 ? (
            <li className="px-2 py-3 text-sm text-text-tertiary">
              {dict.admin.mergeNoResults}
            </li>
          ) : (
            matches.map((target) => (
              <li key={target.id}>
                <button
                  type="button"
                  onClick={() => setSelected(target.id)}
                  aria-pressed={selected === target.id}
                  className={`flex w-full items-center gap-2 rounded-input px-2.5 py-2 text-start text-sm transition-colors duration-(--dur-micro) ${
                    selected === target.id
                      ? "bg-info-tint font-semibold text-info-label"
                      : "text-text-secondary hover:bg-subtle hover:text-text"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{target.title}</span>
                  <span className="shrink-0 text-xs text-text-tertiary">
                    {target.statusLabel}
                  </span>
                  {selected === target.id ? (
                    <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-control border border-border px-4 text-sm font-semibold text-text-secondary"
          >
            {dict.admin.cancel}
          </button>
          <button
            type="button"
            disabled={!selected || pending}
            onClick={() =>
              startTransition(async () => {
                await mergeSubmissionAction(locale, submission.id, selected!);
                onClose();
              })
            }
            className="inline-flex h-10 items-center gap-2 rounded-control bg-brand-solid px-4 text-sm font-semibold text-brand-solid-text disabled:opacity-50"
          >
            <GitMerge className="size-4" strokeWidth={2} aria-hidden />
            {dict.admin.mergeConfirm}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function RejectDialog({
  submission,
  locale,
  dict,
  onClose,
}: {
  submission: QueueSubmission;
  locale: Locale;
  dict: Dictionary;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const noteRef = useRef<HTMLTextAreaElement>(null);

  return (
    <Dialog
      open
      label={dict.admin.rejectTitle}
      onClose={onClose}
      containerClassName="max-w-md"
      initialFocusRef={noteRef}
    >
      <div className="flex flex-col gap-5 p-6">
        <div>
          <h2 className="text-lg font-bold text-text">{dict.admin.rejectTitle}</h2>
          <p className="mt-1 text-sm text-text-secondary">{dict.admin.rejectHint}</p>
        </div>

        <Field id="reject-note" label={dict.admin.rejectNote}>
          <textarea
            ref={noteRef}
            id="reject-note"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={`${FIELD_CLASS} resize-y`}
          />
        </Field>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-control border border-border px-4 text-sm font-semibold text-text-secondary"
          >
            {dict.admin.cancel}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await rejectSubmissionAction(locale, submission.id, note);
                onClose();
              })
            }
            className="inline-flex h-10 items-center gap-2 rounded-control bg-danger px-4 text-sm font-semibold text-white disabled:opacity-70"
          >
            <X className="size-4" strokeWidth={2} aria-hidden />
            {dict.admin.rejectConfirm}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
