"use client";

import { useActionState, useRef, useState } from "react";
import { CircleCheck, Mail, Send, Sparkles } from "lucide-react";

import { Confetti } from "@/components/ui/Confetti";
import { Dialog } from "@/components/ui/Dialog";
import { FIELD_CLASS, Field } from "@/components/ui/Field";
import { submitIdeaAction, type SubmitState } from "@/app/[locale]/actions";
import { t, type Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { LIMITS } from "@/lib/validation";

export interface SubmitCategory {
  slug: string;
  name: string;
}

/**
 * Idea submission.
 *
 * Two states in one dialog: the form, and the confirmation that replaces it.
 * The confirmation is the moment the brief asks to feel good, so it gets the
 * confetti — and a live region, so it lands for someone who cannot see it.
 */
export function SubmitIdeaDialog({
  open,
  onClose,
  onReset,
  locale,
  dict,
  categories,
  defaultName = "",
  accountEmail,
}: {
  open: boolean;
  onClose: () => void;
  /** Remounts this dialog with a clean form — see the launcher. */
  onReset: () => void;
  locale: Locale;
  dict: Dictionary;
  categories: SubmitCategory[];
  defaultName?: string;
  /** The signed-in account's address; submissions always come from it. */
  accountEmail: string;
}) {
  const action = submitIdeaAction.bind(null, locale);
  const [state, formAction, pending] = useActionState<SubmitState, FormData>(action, {
    status: "idle",
  });
  const [descriptionLength, setDescriptionLength] = useState(0);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  const errors = state.status === "invalid" ? state.errors : {};
  const succeeded = state.status === "success";

  return (
    <Dialog
      open={open}
      label={dict.submit.title}
      onClose={onClose}
      containerClassName="max-w-lg"
      initialFocusRef={succeeded ? doneRef : firstFieldRef}
    >
      {succeeded ? (
        <div className="relative overflow-hidden px-6 py-12 text-center">
          <Confetti />
          <div className="relative">
            <span className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-stage-shipped-bg text-stage-shipped-text">
              <CircleCheck className="size-7" strokeWidth={2} aria-hidden />
            </span>
            <h2 className="text-xl font-bold text-text">{dict.submit.successTitle}</h2>
            {/* Announced, not just shown — the confetti carries none of this. */}
            <p role="status" className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
              {dict.submit.successBody}
            </p>

            <div className="mt-7 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={onReset}
                className="h-10 rounded-control border border-border px-4 text-sm font-semibold text-text-secondary transition-colors duration-(--dur-micro) hover:text-text"
              >
                {dict.submit.successAnother}
              </button>
              <button
                ref={doneRef}
                type="button"
                onClick={onClose}
                className="gradient-brand h-10 rounded-control px-5 text-sm font-semibold text-white shadow-sm"
              >
                {dict.submit.successClose}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-5 p-6">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-text">
              <Sparkles className="size-5 text-flovoo-violet" strokeWidth={2} aria-hidden />
              {dict.submit.title}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">{dict.submit.body}</p>
          </div>

          {/* Honeypot: off-screen, unlabelled, and skipped by keyboard. A person
              never sees it; a bot fills everything it finds. */}
          <div aria-hidden className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
            <label htmlFor="company">Company</label>
            <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          <Field
            id="idea-title"
            label={dict.submit.fieldTitle}
            error={errors.title ? dict.fieldError[errors.title] : undefined}
          >
            <input
              ref={firstFieldRef}
              id="idea-title"
              name="title"
              required
              maxLength={LIMITS.title.max}
              placeholder={dict.submit.fieldTitlePlaceholder}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "idea-title-error" : undefined}
              className={FIELD_CLASS}
            />
          </Field>

          <Field
            id="idea-description"
            label={dict.submit.fieldDescription}
            hint={dict.submit.fieldDescriptionHint}
            error={errors.description ? dict.fieldError[errors.description] : undefined}
          >
            <textarea
              id="idea-description"
              name="description"
              rows={4}
              maxLength={LIMITS.description.max}
              placeholder={dict.submit.fieldDescriptionPlaceholder}
              onChange={(event) => setDescriptionLength(event.target.value.length)}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? "idea-description-error" : undefined}
              className={`${FIELD_CLASS} resize-y`}
            />
            <span className="numeric text-end text-xs text-text-tertiary">
              {t(dict.submit.charactersLeft, {
                count: LIMITS.description.max - descriptionLength,
              })}
            </span>
          </Field>

          <Field
            id="idea-category"
            label={dict.submit.fieldCategory}
            error={errors.category ? dict.fieldError[errors.category] : undefined}
          >
            <select id="idea-category" name="category" className={FIELD_CLASS} defaultValue="">
              <option value="">{dict.submit.fieldCategoryNone}</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id="idea-name"
            label={dict.submit.fieldName}
            error={errors.name ? dict.fieldError[errors.name] : undefined}
          >
            <input
              id="idea-name"
              name="name"
              autoComplete="name"
              required
              defaultValue={defaultName}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "idea-name-error" : undefined}
              className={FIELD_CLASS}
            />
          </Field>

          {/* The address is the account's — there is nothing to type or mistype. */}
          <p className="flex flex-wrap items-center gap-1.5 rounded-input bg-subtle px-3 py-2 text-xs text-text-secondary">
            <Mail className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
            {dict.submit.sendingAs}
            <span dir="ltr" className="font-semibold text-text">{accountEmail}</span>
          </p>

          {state.status === "error" ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {state.reason === "rateLimited" ? dict.submit.rateLimited : dict.submit.failed}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-control border border-border px-4 text-sm font-semibold text-text-secondary transition-colors duration-(--dur-micro) hover:text-text"
            >
              {dict.submit.cancel}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="gradient-brand inline-flex h-10 items-center gap-2 rounded-control px-5 text-sm font-semibold text-white shadow-sm disabled:opacity-70"
            >
              <Send className="size-4 rtl:-scale-x-100" strokeWidth={2} aria-hidden />
              {pending ? dict.submit.sending : dict.submit.send}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
