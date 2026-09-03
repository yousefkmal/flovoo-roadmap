"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Check, Link2, ListFilter, Search } from "lucide-react";

import { EntryBody } from "@/components/updates/EntryBody";
import { CategoryTag, KindTag } from "@/components/updates/EntryTag";
import { ReactionBar, type Reaction } from "@/components/updates/ReactionBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDismissable } from "@/components/ui/useDismissable";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { CHANGELOG_KINDS, type ChangelogKind } from "@/lib/types";
import { useRef } from "react";

export interface ChangelogEntryView {
  id: string;
  kind: ChangelogKind;
  title: string;
  paragraphs: string[];
  dateLabel: string;
  dateTime: string;
  imageUrl: string | null;
  imageAlt: string;
  categoryName: string | null;
  /** "Read more", if this entry has a fuller write-up somewhere. */
  articleUrl: string | null;
  /** "Explore it", if there is somewhere in the product to go and see it. */
  actionUrl: string | null;
  actionLabel: string;
  reactions: Reaction[];
  /** Lower-cased title + body, so filtering is one substring test. */
  haystack: string;
}

/**
 * The Updates feed.
 *
 * Each entry is a sticky rail carrying the date and its tags, beside the entry
 * itself. Below `md` the rail collapses into a single row above the content —
 * date at the start, tags at the end — which is how the reference handles it.
 *
 * Search and the kind filter are desktop-only, also matching: on a phone the
 * list is short enough to scroll and the controls would cost more room than
 * they save.
 */
export function ChangelogList({
  entries,
  locale,
  dict,
  googleEnabled,
}: {
  entries: ChangelogEntryView[];
  locale: Locale;
  dict: Dictionary;
  googleEnabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ChangelogKind | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (kind && entry.kind !== kind) return false;
      if (needle && !entry.haystack.includes(needle)) return false;
      return true;
    });
  }, [entries, query, kind]);

  return (
    <>
      <div className="mt-6 hidden items-center justify-end gap-2 md:flex">
        <KindFilter kind={kind} onChange={setKind} dict={dict} />
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted"
            strokeWidth={2}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dict.updates.searchPlaceholder}
            aria-label={dict.updates.searchLabel}
            className="h-9 w-56 rounded-control border border-border bg-card ps-9 pe-3 text-sm text-text outline-none transition-colors duration-(--dur-micro) placeholder:text-placeholder focus:border-flovoo-blue"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          className="mt-10"
          title={dict.updates.emptyTitle}
          body={dict.updates.emptyBody}
        />
      ) : (
        <div className="mt-10 flex flex-col gap-12 sm:gap-20">
          {visible.map((entry, index) => (
            <article
              key={entry.id}
              id={entry.id}
              className={`relative scroll-mt-6 md:flex ${
                index > 0 ? "border-t border-border pt-12 sm:pt-20" : ""
              }`}
            >
              <div className="mb-5 w-full flex-shrink-0 text-sm md:mb-0 md:mt-2 md:w-[200px] md:pe-12">
                <div className="sticky top-6 flex items-center justify-between gap-3 md:flex-col md:items-start">
                  <time
                    dateTime={entry.dateTime}
                    className="numeric flex items-center text-xs font-medium text-text-tertiary"
                  >
                    {entry.dateLabel}
                  </time>
                  <div className="flex items-center gap-1.5">
                    <KindTag kind={entry.kind} label={dict.updates[entry.kind]} />
                    {entry.categoryName ? (
                      <CategoryTag label={entry.categoryName} />
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                {entry.imageUrl ? (
                  /* Cover images are admin-uploaded to an arbitrary host, so
                     they cannot be enumerated in the image config. */
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.imageUrl}
                    alt={entry.imageAlt}
                    width={1200}
                    height={600}
                    loading="lazy"
                    decoding="async"
                    className="mb-8 aspect-[2/1] w-full rounded-control border border-border object-cover"
                  />
                ) : null}

                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-2xl/8 font-semibold text-text">{entry.title}</h2>
                  <CopyLinkButton
                    entryId={entry.id}
                    label={dict.updates.copyLink}
                    copiedLabel={dict.updates.linkCopied}
                  />
                </div>

                <div className="mt-4">
                  <EntryBody
                    id={`entry-body-${entry.id}`}
                    paragraphs={entry.paragraphs}
                    moreLabel={dict.updates.continueReading}
                  />
                </div>

                {entry.articleUrl ? (
                  <p className="mt-4">
                    <a
                      href={entry.articleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-link hover:underline"
                    >
                      {dict.updates.readMore}
                      <ArrowUpRight className="size-4 rtl:-scale-x-100" strokeWidth={2} aria-hidden />
                      <span className="sr-only">{dict.updates.opensInNewTab}</span>
                    </a>
                  </p>
                ) : null}

                {entry.actionUrl ? (
                  <p className="mt-5">
                    {/* Solid Flovoo Blue, not the gradient: the design system
                        allows one gradient CTA per view and the subscribe
                        button has it, and a feed of gradient buttons would stop
                        meaning anything. Solid still reads as Flovoo. */}
                    <a
                      href={entry.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center gap-2 rounded-control bg-brand-solid px-4 text-sm font-semibold text-brand-solid-text shadow-sm transition-transform duration-(--dur-micro) hover:-translate-y-px"
                    >
                      {entry.actionLabel}
                      <ArrowUpRight className="size-4 rtl:-scale-x-100" strokeWidth={2} aria-hidden />
                      <span className="sr-only">{dict.updates.opensInNewTab}</span>
                    </a>
                  </p>
                ) : null}

                <div className="mt-6">
                  <ReactionBar
                    entryId={entry.id}
                    reactions={entry.reactions}
                    locale={locale}
                    dict={dict}
                    googleEnabled={googleEnabled}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function KindFilter({
  kind,
  onChange,
  dict,
}: {
  kind: ChangelogKind | null;
  onChange: (kind: ChangelogKind | null) => void;
  dict: Dictionary;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useDismissable(open, wrapRef, (reason) => {
    setOpen(false);
    if (reason === "escape") buttonRef.current?.focus();
  });

  function select(next: ChangelogKind | null) {
    onChange(next);
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={dict.updates.filterLabel}
        className={`inline-flex h-9 items-center gap-2 rounded-control border px-2.5 text-sm font-semibold transition-colors duration-(--dur-micro) ${
          kind
            ? "border-flovoo-blue bg-info-tint text-info-label"
            : "border-border bg-card text-text-secondary hover:text-text"
        }`}
      >
        <ListFilter className="size-4" strokeWidth={2} aria-hidden />
        {kind ? <span>{dict.updates[kind]}</span> : null}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={dict.updates.filterLabel}
          className="absolute top-full end-0 z-30 mt-2 w-48 overflow-hidden rounded-card border border-border bg-card p-1.5 shadow-lg"
        >
          <Option label={dict.updates.allKinds} selected={kind === null} onSelect={() => select(null)} />
          <div className="my-1.5 border-t border-border" />
          {CHANGELOG_KINDS.map((option) => (
            <Option
              key={option}
              label={dict.updates[option]}
              selected={kind === option}
              onSelect={() => select(option)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Option({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-center gap-2 rounded-input px-2.5 py-2 text-start text-sm transition-colors duration-(--dur-micro) ${
        selected
          ? "bg-subtle font-semibold text-text"
          : "text-text-secondary hover:bg-subtle hover:text-text"
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {selected ? (
        <Check className="size-4 shrink-0 text-flovoo-blue" strokeWidth={2.5} aria-hidden />
      ) : null}
    </button>
  );
}


/**
 * Copies a permalink to one entry — the same affordance the reference puts
 * beside each title, and what makes the anchors in the RSS feed reachable.
 */
function CopyLinkButton({
  entryId,
  label,
  copiedLabel,
}: {
  entryId: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy() {
    const url = `${window.location.origin}${window.location.pathname}#${entryId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard access can be refused; the address bar still works.
      window.location.hash = entryId;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  }

  return (
    <span className="relative shrink-0">
      <button
        type="button"
        onClick={copy}
        aria-label={label}
        className="inline-flex size-8 items-center justify-center rounded-control text-text-tertiary transition-colors duration-(--dur-micro) hover:bg-subtle hover:text-text"
      >
        <Link2 className="size-4" strokeWidth={2} aria-hidden />
      </button>
      <span
        role="status"
        className={`pointer-events-none absolute top-full end-0 z-20 mt-1 w-max rounded-control bg-flovoo-navy px-2 py-1 text-xs font-medium text-white shadow-lg transition-opacity duration-(--dur-standard) ${
          copied ? "opacity-100" : "invisible opacity-0"
        }`}
      >
        {copied ? copiedLabel : ""}
      </span>
    </span>
  );
}
