"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Bell, BellRing } from "lucide-react";

import { SignInDialog } from "@/components/account/SignInDialog";
import { followAction } from "@/app/[locale]/actions";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

/**
 * "Tell me when this ships."
 *
 * Separate from voting on purpose: wanting a thing and wanting to be emailed
 * about it are different intents, and someone may want the second without the
 * first. A vote also counts as interest when notifications go out — see
 * `enqueue_shipped_notifications` — so this is for people who want to follow
 * without adding their weight to it.
 */
export function FollowButton({
  featureId,
  isFollowing,
  locale,
  dict,
  googleEnabled,
}: {
  featureId: string;
  isFollowing: boolean;
  locale: Locale;
  dict: Dictionary;
  googleEnabled: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic(
    isFollowing,
    (_state, next: boolean) => next,
  );
  const [pending, startTransition] = useTransition();
  const [signInOpen, setSignInOpen] = useState(false);

  function onClick() {
    startTransition(async () => {
      setOptimistic(!optimistic);
      const result = await followAction(locale, featureId);
      if (result.status === "needsAuth") setSignInOpen(true);
    });
  }

  const Icon = optimistic ? BellRing : Bell;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={optimistic}
        className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-control border text-sm font-semibold transition-colors duration-(--dur-micro) disabled:opacity-70 ${
          optimistic
            ? "border-flovoo-blue bg-info-tint text-info-label"
            : "border-border bg-card text-text-secondary hover:border-flovoo-blue/60 hover:text-text"
        }`}
      >
        <Icon className="size-4 shrink-0" strokeWidth={2} aria-hidden />
        {optimistic ? dict.follow.following : dict.follow.notifyMe}
      </button>

      <SignInDialog
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        locale={locale}
        dict={dict}
        googleEnabled={googleEnabled}
        reason="follow"
      />
    </>
  );
}
