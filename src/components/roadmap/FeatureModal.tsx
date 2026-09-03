"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";

import { CategoryChip } from "@/components/ui/CategoryChip";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FollowButton } from "@/components/vote/FollowButton";
import { VoteControl } from "@/components/vote/VoteControl";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { STATUS_FLOW, STATUS_STYLE } from "@/lib/status";
import type { FeatureView } from "@/lib/view";

/**
 * Feature detail — a centred modal, not a side panel.
 *
 * Layout follows the reference portal: the post itself on the main side, a meta
 * rail beside it (votes, status, category, dates), a close control at the
 * overlay's corner, and stacked previous/next controls to walk the board
 * without going back to it.
 *
 * Below `lg` the rail stacks under the content and the three controls collapse
 * into the panel's own top bar, where they stay reachable with one thumb.
 */
export function FeatureModal({
  feature,
  dict,
  locale,
  googleEnabled,
  onClose,
  onPrev,
  onNext,
}: {
  feature: FeatureView | null;
  dict: Dictionary;
  locale: Locale;
  googleEnabled: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  const isOpen = feature !== null;

  useEffect(() => {
    if (!isOpen) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      // Keep Tab inside the dialog while it is modal.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      restoreFocusTo.current?.focus();
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {feature ? (
        <motion.div
          key="modal-root"
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain p-0 sm:p-6 lg:p-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="fixed inset-0 bg-flovoo-navy/55 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden
          />

          <div ref={panelRef} className="relative mx-auto flex w-full max-w-5xl gap-3">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={dict.detail.dialogLabel}
              initial={{ opacity: 0, y: 12, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="min-h-full w-full min-w-0 overflow-hidden border-border bg-card shadow-lg sm:min-h-0 sm:rounded-card sm:border"
            >
              {/* Controls live in the panel below lg, and move outside it above. */}
              <div className="sticky top-0 z-10 flex items-center justify-end gap-1 border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur lg:hidden">
                <StepButton
                  direction="prev"
                  label={dict.detail.previous}
                  onClick={onPrev}
                />
                <StepButton
                  direction="next"
                  label={dict.detail.next}
                  onClick={onNext}
                />
                <button
                  ref={closeRef}
                  type="button"
                  onClick={onClose}
                  aria-label={dict.detail.close}
                  className="rounded-control border border-border p-2 text-text-secondary transition-colors duration-(--dur-micro) hover:text-text"
                >
                  <X className="size-4" strokeWidth={2} aria-hidden />
                </button>
              </div>

              <div className="flex flex-col lg:flex-row">
                <div className="min-w-0 flex-1 px-5 py-6 sm:px-6">
                  <h2 className="text-xl font-bold leading-snug text-text sm:text-2xl">
                    {feature.title}
                  </h2>

                  <section className="mt-5">
                    <h3 className="label-caps mb-2 text-text-secondary">
                      {dict.detail.description}
                    </h3>
                    <p className="text-sm leading-relaxed text-text-secondary">
                      {feature.description ?? dict.detail.noDescription}
                    </p>
                  </section>

                  <StatusTimeline feature={feature} dict={dict} />

                  <p className="mt-6 rounded-card border border-dashed border-border px-4 py-3 text-xs text-text-tertiary">
                    {dict.detail.commentsSoon}
                  </p>
                </div>

                <aside className="shrink-0 border-t border-border px-5 py-6 sm:px-6 lg:w-80 lg:border-s lg:border-t-0">
                  <dl className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-sm font-semibold text-text-secondary">
                        {dict.detail.voters}
                      </dt>
                      <dd>
                        <VoteControl
                          featureId={feature.id}
                          title={feature.title}
                          count={feature.votes}
                          hasVoted={feature.hasVoted}
                          locale={locale}
                          dict={dict}
                          googleEnabled={googleEnabled}
                        />
                      </dd>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-sm font-semibold text-text-secondary">
                        {dict.detail.status}
                      </dt>
                      <dd>
                        <StatusBadge
                          status={feature.status}
                          label={dict.status[feature.status]}
                        />
                      </dd>
                    </div>

                    {feature.category ? (
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-sm font-semibold text-text-secondary">
                          {dict.detail.category}
                        </dt>
                        <dd>
                          <CategoryChip
                            name={feature.category.name}
                            color={feature.category.color}
                          />
                        </dd>
                      </div>
                    ) : null}

                    <div className="pt-1">
                      <FollowButton
                        featureId={feature.id}
                        isFollowing={feature.isFollowing}
                        locale={locale}
                        dict={dict}
                        googleEnabled={googleEnabled}
                      />
                    </div>

                    <div className="border-t border-border pt-4" />

                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-sm font-semibold text-text-secondary">
                        {dict.detail.added}
                      </dt>
                      <dd className="numeric text-sm font-semibold text-text">
                        {feature.createdLabel}
                      </dd>
                    </div>

                    {feature.shippedLabel ? (
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-sm font-semibold text-text-secondary">
                          {dict.detail.shippedOn}
                        </dt>
                        <dd className="numeric text-sm font-semibold text-text">
                          {feature.shippedLabel}
                        </dd>
                      </div>
                    ) : null}

                    {feature.submittedBy ? (
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-sm font-semibold text-text-secondary">
                          {dict.detail.author}
                        </dt>
                        <dd className="text-sm font-semibold text-text">
                          {feature.submittedBy}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </aside>
              </div>
            </motion.div>

            {/* From lg up: close at the overlay corner, stepper beside the panel. */}
            <div className="sticky top-0 hidden shrink-0 flex-col gap-2 lg:flex">
              <button
                type="button"
                onClick={onClose}
                aria-label={dict.detail.close}
                className="rounded-control border border-white/20 bg-white/10 p-2 text-white backdrop-blur transition-colors duration-(--dur-micro) hover:bg-white/20"
              >
                <X className="size-5" strokeWidth={2} aria-hidden />
              </button>
              <div className="mt-2 flex flex-col gap-1">
                <StepButton
                  direction="prev"
                  label={dict.detail.previous}
                  onClick={onPrev}
                  onOverlay
                />
                <StepButton
                  direction="next"
                  label={dict.detail.next}
                  onClick={onNext}
                  onOverlay
                />
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function StepButton({
  direction,
  label,
  onClick,
  onOverlay = false,
}: {
  direction: "prev" | "next";
  label: string;
  onClick?: () => void;
  onOverlay?: boolean;
}) {
  const Icon = direction === "prev" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={label}
      className={
        onOverlay
          ? "rounded-control border border-white/20 bg-white/10 p-2 text-white backdrop-blur transition-colors duration-(--dur-micro) hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          : "rounded-control border border-border p-2 text-text-secondary transition-colors duration-(--dur-micro) hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
      }
    >
      <Icon className="size-4 lg:size-5" strokeWidth={2} aria-hidden />
    </button>
  );
}

function StatusTimeline({
  feature,
  dict,
}: {
  feature: FeatureView;
  dict: Dictionary;
}) {
  const currentIndex = (STATUS_FLOW as readonly string[]).indexOf(feature.status);

  return (
    <section className="mt-6">
      <h3 className="label-caps mb-3 text-text-secondary">{dict.detail.timeline}</h3>
      <ol className="flex flex-col gap-3">
        {STATUS_FLOW.map((status, index) => {
          const isDone = currentIndex > index;
          const isCurrent = currentIndex === index;
          const style = STATUS_STYLE[status];

          return (
            <li key={status} className="flex items-start gap-3">
              {/* A glyph inside the dot would have to clear 3:1 against every
                  status hue, and white on the amber of "in progress" is 2.4:1.
                  Filled vs. outline says the same thing, and the state is
                  announced in text just below. */}
              <span
                aria-hidden
                className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
                  isDone || isCurrent ? style.dot : "bg-border"
                } ${isCurrent ? `ring-4 ${style.ring}` : ""}`}
              />
              <span className="min-w-0">
                <span
                  className={`block text-sm ${
                    isCurrent
                      ? "font-bold text-text"
                      : isDone
                        ? "font-medium text-text"
                        : "text-text-tertiary"
                  }`}
                >
                  {dict.status[status]}
                </span>
                {isCurrent ? (
                  <span className="block text-xs text-text-secondary">
                    {dict.statusHint[status]}
                  </span>
                ) : null}
              </span>
              <span className="sr-only">
                {isCurrent
                  ? dict.detail.timelineCurrent
                  : isDone
                    ? dict.detail.timelineDone
                    : dict.detail.timelineUpcoming}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
