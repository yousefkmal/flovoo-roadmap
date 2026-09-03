"use client";

import { Pin } from "lucide-react";

import { CategoryChip } from "@/components/ui/CategoryChip";
import { VoteControl } from "@/components/vote/VoteControl";
import { t, type Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { FeatureView } from "@/lib/view";

/**
 * A board card: title, one meta row, vote pill. Nothing else.
 *
 * The description deliberately does not appear here — it is what turns a board
 * into a wall of text. It lives in the detail modal, one click away.
 *
 * The whole card is clickable, but only the title carries the button: it
 * stretches over the card with `after:absolute inset-0`, which keeps the vote
 * button from being nested inside another button.
 */
export function FeatureCard({
  feature,
  dict,
  locale,
  googleEnabled,
  onOpen,
}: {
  feature: FeatureView;
  dict: Dictionary;
  locale: Locale;
  googleEnabled: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <article className="group relative rounded-control border border-border bg-card p-3 shadow-sm transition-colors duration-(--dur-standard) ease-(--ease-expo) hover:border-flovoo-blue/40 focus-within:border-flovoo-blue/60">
      <h3 className="text-sm/5 font-semibold text-text">
        <button
          type="button"
          onClick={() => onOpen(feature.id)}
          aria-label={t(dict.card.openDetails, { title: feature.title })}
          className="line-clamp-3 text-start after:absolute after:inset-0 after:rounded-control after:content-[''] group-hover:underline"
        >
          {feature.title}
        </button>
      </h3>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {feature.category ? (
            <CategoryChip
              name={feature.category.name}
              color={feature.category.color}
            />
          ) : null}
          {feature.isNew ? (
            <span className="rounded-control bg-info-tint px-2 py-1 text-xs font-semibold text-info-label">
              {dict.card.newBadge}
            </span>
          ) : null}
          {feature.isPinned ? (
            <span className="text-text-tertiary">
              <Pin className="size-4" strokeWidth={2} aria-hidden />
              <span className="sr-only">{dict.card.pinned}</span>
            </span>
          ) : null}
        </div>

        <div className="relative z-10 shrink-0">
          <VoteControl
            featureId={feature.id}
            title={feature.title}
            count={feature.votes}
            hasVoted={feature.hasVoted}
            locale={locale}
            dict={dict}
            googleEnabled={googleEnabled}
          />
        </div>
      </div>
    </article>
  );
}
