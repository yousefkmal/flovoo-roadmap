"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Mail, MailCheck } from "lucide-react";

import { Dialog } from "@/components/ui/Dialog";
import { FIELD_CLASS, Field } from "@/components/ui/Field";
import { emailSignInAction, googleSignInAction, type AuthState } from "@/app/[locale]/actions";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

/** Google's mark. Their brand guidelines require the official four-colour glyph. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

/**
 * The sign-in gate.
 *
 * Voting and submitting need an account so the person can be told when the
 * thing they asked for ships. Two ways in: Google in one press, or an email
 * link. Neither asks for a password — a roadmap portal has no business holding
 * one.
 */
export function SignInDialog({
  open,
  onClose,
  locale,
  dict,
  googleEnabled,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  dict: Dictionary;
  /** False when Supabase is not configured — see the development note below. */
  googleEnabled: boolean;
  /** Why the gate appeared, so the copy can say so. */
  reason?: "vote" | "submit" | "follow";
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const next = `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`;

  const [googlePending, startGoogle] = useTransition();
  const [googleError, setGoogleError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const [state, formAction, emailPending] = useActionState<AuthState, FormData>(
    async (prev, formData) => {
      const result = await emailSignInAction(locale, next, prev, formData);
      if (result.status === "signedIn") onClose();
      return result;
    },
    { status: "idle" },
  );

  function onGoogle() {
    setGoogleError(null);
    startGoogle(async () => {
      const result = await googleSignInAction(locale, next);
      if ("url" in result) window.location.assign(result.url);
      else setGoogleError(dict.auth.googleUnavailable);
    });
  }

  const errors = state.status === "invalid" ? state.errors : {};
  const sent = state.status === "sent";

  const subtitle =
    reason === "submit"
      ? dict.auth.reasonSubmit
      : reason === "follow"
        ? dict.auth.reasonFollow
        : dict.auth.reasonVote;

  return (
    <Dialog
      open={open}
      label={dict.auth.title}
      onClose={onClose}
      containerClassName="max-w-md"
      initialFocusRef={emailRef}
    >
      {sent ? (
        <div className="px-6 py-10 text-center">
          <span className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-stage-shipped-bg text-stage-shipped-text">
            <MailCheck className="size-7" strokeWidth={2} aria-hidden />
          </span>
          <h2 className="text-lg font-bold text-text">{dict.auth.sentTitle}</h2>
          <p role="status" className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
            {dict.auth.sentBody} <span dir="ltr" className="font-semibold text-text">{state.email}</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 h-10 rounded-control border border-border px-4 text-sm font-semibold text-text-secondary transition-colors duration-(--dur-micro) hover:text-text"
          >
            {dict.submit.successClose}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5 p-6">
          <div>
            <h2 className="text-lg font-bold text-text">{dict.auth.title}</h2>
            <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onGoogle}
            disabled={!googleEnabled || googlePending}
            title={googleEnabled ? undefined : dict.auth.googleUnavailable}
            className="inline-flex h-11 items-center justify-center gap-3 rounded-control border border-border bg-card text-sm font-semibold text-text transition-colors duration-(--dur-micro) hover:border-flovoo-blue/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleMark />
            {dict.auth.google}
          </button>

          {googleError ? (
            <p role="alert" className="text-sm font-medium text-danger">{googleError}</p>
          ) : null}

          <div className="flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-text-tertiary">{dict.auth.or}</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form action={formAction} className="flex flex-col gap-4">
            <Field
              id="auth-name"
              label={dict.submit.fieldName}
              hint={dict.auth.nameHint}
              error={errors.name ? dict.fieldError[errors.name] : undefined}
            >
              <input
                id="auth-name"
                name="name"
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "auth-name-error" : undefined}
                className={FIELD_CLASS}
              />
            </Field>

            <Field
              id="auth-email"
              label={dict.submit.fieldEmail}
              error={errors.email ? dict.fieldError[errors.email] : undefined}
            >
              <input
                ref={emailRef}
                id="auth-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                dir="ltr"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "auth-email-error" : undefined}
                className={`${FIELD_CLASS} text-start`}
              />
            </Field>

            {state.status === "error" ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {dict.auth.failed}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={emailPending}
              className="gradient-brand inline-flex h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-70"
            >
              <Mail className="size-4" strokeWidth={2} aria-hidden />
              {emailPending ? dict.auth.sending : dict.auth.emailSubmit}
            </button>
          </form>

          <p className="text-xs text-text-tertiary">{dict.auth.privacy}</p>
        </div>
      )}
    </Dialog>
  );
}
