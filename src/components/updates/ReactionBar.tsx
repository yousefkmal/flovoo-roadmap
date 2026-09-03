"use client";

import { useOptimistic, useState, useTransition } from "react";
import { SmilePlus } from "lucide-react";

import { SignInDialog } from "@/components/account/SignInDialog";
import { useDismissable } from "@/components/ui/useDismissable";
import { reactAction } from "@/app/[locale]/actions";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { REACTION_EMOJI } from "@/lib/types";
import { useRef } from "react";

export interface Reaction {
  emoji: string;
  count: number;
  mine: boolean;
}

/**
 * Emoji reactions on a changelog entry.
 *
 * Only emoji that someone has actually used are shown, plus one button to add
 * another — the same shape as the reference. Showing all five on every entry
 * would turn a quiet row into a demand.
 */
export function ReactionBar({
  entryId,
  reactions,
  locale,
  dict,
  googleEnabled,
}: {
  entryId: string;
  reactions: Reaction[];
  locale: Locale;
  dict: Dictionary;
  googleEnabled: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic(
    reactions,
    (state: Reaction[], emoji: string) => {
      const existing = state.find((r) => r.emoji === emoji);
      if (!existing) return [...state, { emoji, count: 1, mine: true }];
      return state
        .map((r) =>
          r.emoji === emoji
            ? { ...r, count: r.count + (r.mine ? -1 : 1), mine: !r.mine }
            : r,
        )
        .filter((r) => r.count > 0);
    },
  );
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useDismissable(pickerOpen, pickerRef, () => setPickerOpen(false));

  function react(emoji: string) {
    setPickerOpen(false);
    startTransition(async () => {
      setOptimistic(emoji);
      const result = await reactAction(locale, entryId, emoji);
      if (result.status === "needsAuth") setSignInOpen(true);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {optimistic.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          onClick={() => react(reaction.emoji)}
          disabled={pending}
          aria-pressed={reaction.mine}
          aria-label={`${reaction.emoji} ${reaction.count}`}
          className={`inline-flex h-8 items-center gap-1.5 rounded-control border px-2 text-sm transition-colors duration-(--dur-micro) disabled:opacity-70 ${
            reaction.mine
              ? "border-flovoo-blue bg-info-tint"
              : "border-border bg-subtle hover:border-flovoo-blue/60"
          }`}
        >
          <span aria-hidden>{reaction.emoji}</span>
          <span className="numeral text-xs font-semibold text-text-secondary">
            {reaction.count}
          </span>
        </button>
      ))}

      <div ref={pickerRef} className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={pickerOpen}
          aria-label={dict.updates.addReaction}
          className="inline-flex size-8 items-center justify-center rounded-control border border-border bg-subtle text-text-secondary transition-colors duration-(--dur-micro) hover:border-flovoo-blue/60 hover:text-text"
        >
          <SmilePlus className="size-4" strokeWidth={2} aria-hidden />
        </button>

        {pickerOpen ? (
          <div
            role="menu"
            aria-label={dict.updates.addReaction}
            className="absolute bottom-full start-0 z-30 mb-2 flex gap-1 rounded-control border border-border bg-card p-1.5 shadow-lg"
          >
            {REACTION_EMOJI.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="menuitem"
                onClick={() => react(emoji)}
                aria-label={emoji}
                className="inline-flex size-8 items-center justify-center rounded-input text-lg transition-colors duration-(--dur-micro) hover:bg-subtle"
              >
                <span aria-hidden>{emoji}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

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
