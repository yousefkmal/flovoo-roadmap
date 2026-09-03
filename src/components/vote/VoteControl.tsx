"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ChevronUp } from "lucide-react";

import { SignInDialog } from "@/components/account/SignInDialog";
import { voteAction } from "@/app/[locale]/actions";
import { t, type Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

/**
 * The vote control.
 *
 * The count moves the instant it is pressed and rolls back if the server says
 * no — waiting for a round trip to acknowledge a single click is the thing that
 * makes a board feel slow.
 *
 * Voting needs an account. Someone signed out gets the sign-in dialog rather
 * than a refusal, and the press is not silently lost: they land back here and
 * press again, now identified.
 */
export function VoteControl({
  featureId,
  title,
  count,
  hasVoted,
  locale,
  dict,
  googleEnabled,
}: {
  featureId: string;
  title: string;
  count: number;
  hasVoted: boolean;
  locale: Locale;
  dict: Dictionary;
  googleEnabled: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic(
    { count, voted: hasVoted },
    (_state, next: { count: number; voted: boolean }) => next,
  );
  const [pending, startTransition] = useTransition();
  const [signInOpen, setSignInOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function onClick(event: React.MouseEvent) {
    // The card behind this button is itself clickable.
    event.stopPropagation();
    event.preventDefault();
    setMessage(null);

    startTransition(async () => {
      setOptimistic({
        count: optimistic.voted ? optimistic.count - 1 : optimistic.count + 1,
        voted: !optimistic.voted,
      });

      const result = await voteAction(locale, featureId);
      if (result.status === "needsAuth") setSignInOpen(true);
      else if (result.status === "error") {
        setMessage(
          result.reason === "rateLimited" ? dict.vote.rateLimited : dict.vote.failed,
        );
      }
    });
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-label={t(optimistic.voted ? dict.vote.remove : dict.vote.add, { title })}
        aria-pressed={optimistic.voted}
        className={`inline-flex h-[30px] w-16 items-center justify-center gap-1 rounded-control border text-sm font-medium transition-colors duration-(--dur-micro) disabled:opacity-70 ${
          optimistic.voted
            ? "border-flovoo-blue bg-info-tint text-info-label"
            : "border-border bg-subtle text-text hover:border-flovoo-blue/60"
        }`}
      >
        <ChevronUp
          className={`size-4 shrink-0 transition-transform duration-(--dur-micro) ${
            optimistic.voted ? "-translate-y-px" : ""
          }`}
          strokeWidth={2}
          aria-hidden
        />
        <span className="numeral font-medium">{optimistic.count}</span>
      </button>

      {message ? (
        <span
          role="alert"
          className="absolute bottom-full end-0 z-20 mb-2 w-max max-w-56 rounded-control bg-danger px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
        >
          {message}
        </span>
      ) : null}

      <SignInDialog
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        locale={locale}
        dict={dict}
        googleEnabled={googleEnabled}
        reason="vote"
      />
    </span>
  );
}
