"use client";

import { FeatureCard } from "@/components/roadmap/FeatureCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { t, type Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { BoardStatus } from "@/lib/types";
import type { FeatureView } from "@/lib/view";

/**
 * One roadmap stage, rendered as a panel.
 *
 * The board is three layers: the page, this panel, and the cards on it. That
 * is what makes a column read as a group and a card as an object inside it —
 * with only two layers the cards float on nothing and the stages stop being
 * legible as containers.
 *
 * Mobile stacks the stages full width and lets the page scroll — no tabs, so
 * every stage is reachable by scrolling and nothing hides behind a control.
 *
 * From `md` all four sit on a single row: never some above and some below. Each
 * holds a 20rem floor and the row scrolls sideways when they do not fit, which
 * is how the reference handles a narrow desktop. At `xl` they share the width
 * and the row stops scrolling.
 *
 * On one row each stage is capped to the viewport and scrolls on its own, so a
 * long stage never stretches the page. On mobile the header is sticky instead,
 * so the stage you are reading stays labelled.
 */
export function BoardColumn({
  status,
  features,
  dict,
  locale,
  googleEnabled,
  onOpen,
}: {
  status: BoardStatus;
  features: FeatureView[];
  dict: Dictionary;
  locale: Locale;
  googleEnabled: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <section
      aria-label={dict.status[status]}
      className="flex min-w-0 flex-col rounded-control bg-column p-2 md:max-h-[calc(100vh-12rem)] md:w-80 md:shrink-0 xl:w-auto xl:flex-1"
    >
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 rounded-control bg-column px-1 py-2 md:static">
        <h2>
          <StatusBadge status={status} label={dict.status[status]} />
        </h2>
        <span className="numeral rounded-control border border-border bg-card px-1.5 py-0.5 text-xs font-semibold text-text-secondary">
          {features.length}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 md:overflow-y-auto">
        {features.length === 0 ? (
          <EmptyState title={dict.emptyColumn.title} compact />
        ) : (
          features.map((feature) => (
            <div key={feature.id} className="animate-rise">
              <FeatureCard
                feature={feature}
                dict={dict}
                locale={locale}
                googleEnabled={googleEnabled}
                onOpen={onOpen}
              />
            </div>
          ))
        )}
      </div>

      <p className="sr-only">{t(dict.board.itemsCount, { count: features.length })}</p>
    </section>
  );
}
