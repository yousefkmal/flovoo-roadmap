"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Bell, BellRing, Rss } from "lucide-react";

import { SignInDialog } from "@/components/account/SignInDialog";
import { updateNotifyScopeAction } from "@/app/[locale]/actions";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { NotifyScope } from "@/lib/auth/session";

/**
 * "Subscribe to updates" — the same preference the account menu carries, put
 * where someone reading the changelog will actually look for it. Pressing it
 * sets the scope to everything; pressing it again returns to following only,
 * rather than to silence, so unsubscribing here never loses the follows made
 * on the board.
 */
export function SubscribeButton({
  scope,
  signedIn,
  locale,
  dict,
  googleEnabled,
  feedHref,
}: {
  scope: NotifyScope | null;
  signedIn: boolean;
  locale: Locale;
  dict: Dictionary;
  googleEnabled: boolean;
  feedHref: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(
    scope === "all",
    (_state, next: boolean) => next,
  );
  const [pending, startTransition] = useTransition();
  const [signInOpen, setSignInOpen] = useState(false);

  function onClick() {
    if (!signedIn) {
      setSignInOpen(true);
      return;
    }
    startTransition(async () => {
      const next = !optimistic;
      setOptimistic(next);
      await updateNotifyScopeAction(locale, next ? "all" : "following");
    });
  }

  const Icon = optimistic ? BellRing : Bell;

  return (
    <div className="mt-6 flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={optimistic}
        className={`inline-flex h-9 items-center gap-2 rounded-control px-3 text-sm font-semibold transition-colors duration-(--dur-micro) disabled:opacity-70 ${
          optimistic
            ? "border border-flovoo-blue bg-info-tint text-info-label"
            : "gradient-brand text-white shadow-sm"
        }`}
      >
        <Icon className="size-4" strokeWidth={2} aria-hidden />
        {optimistic ? dict.updates.subscribed : dict.updates.subscribe}
      </button>

      <a
        href={feedHref}
        aria-label={dict.updates.rss}
        title={dict.updates.rss}
        className="inline-flex size-9 items-center justify-center rounded-control text-text-tertiary transition-colors duration-(--dur-micro) hover:text-text"
      >
        <Rss className="size-4" strokeWidth={2} aria-hidden />
      </a>

      <SignInDialog
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        locale={locale}
        dict={dict}
        googleEnabled={googleEnabled}
        reason="follow"
      />
    </div>
  );
}
