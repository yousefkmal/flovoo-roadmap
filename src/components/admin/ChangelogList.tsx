"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { Eye, EyeOff, Pencil, Sparkles } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { KindTag } from "@/components/updates/EntryTag";
import { toggleChangelogPublishedAction } from "@/app/[locale]/admin/actions";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { ChangelogKind } from "@/lib/types";

export interface AdminChangelogView {
  id: string;
  kind: ChangelogKind;
  title: string;
  isPublished: boolean;
  dateLabel: string | null;
  /** Written by the system when a feature shipped, and not yet reviewed. */
  isAutoDraft: boolean;
}

/**
 * The changelog manager.
 *
 * Drafts sort first: an unpublished entry is the one with work left on it, and
 * a manager that buries them under everything already shipped hides its own
 * to-do list.
 */
export function AdminChangelogList({
  entries,
  locale,
  dict,
}: {
  entries: AdminChangelogView[];
  locale: Locale;
  dict: Dictionary;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        className="mt-8"
        title={dict.admin.changelogEmpty}
        body={dict.admin.changelogEmptyBody}
      />
    );
  }

  return (
    <ul className="mt-6 flex flex-col gap-3">
      {entries.map((entry) => (
        <Row key={entry.id} entry={entry} locale={locale} dict={dict} />
      ))}
    </ul>
  );
}

function Row({
  entry,
  locale,
  dict,
}: {
  entry: AdminChangelogView;
  locale: Locale;
  dict: Dictionary;
}) {
  const [published, setPublished] = useOptimistic(
    entry.isPublished,
    (_state, next: boolean) => next,
  );
  const [pending, startTransition] = useTransition();

  return (
    <li className="rounded-control border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <KindTag kind={entry.kind} label={dict.updates[entry.kind]} />
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                published
                  ? "bg-stage-shipped-bg text-stage-shipped-text"
                  : "bg-subtle text-text-tertiary"
              }`}
            >
              {published ? dict.admin.changelogPublished : dict.admin.changelogDraft}
            </span>
            {entry.dateLabel ? (
              <span className="numeric text-xs text-text-tertiary">
                {entry.dateLabel}
              </span>
            ) : null}
          </div>

          <h2 className="mt-2 text-sm font-semibold text-text">{entry.title}</h2>

          {entry.isAutoDraft ? (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-text-tertiary">
              <Sparkles className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
              {dict.admin.changelogDraftedHint}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={pending}
            aria-pressed={published}
            onClick={() =>
              startTransition(async () => {
                setPublished(!published);
                await toggleChangelogPublishedAction(locale, entry.id);
              })
            }
            className={`inline-flex h-9 items-center gap-1.5 rounded-control border px-3 text-sm font-semibold transition-colors duration-(--dur-micro) disabled:opacity-70 ${
              published
                ? "border-border text-text-secondary hover:text-text"
                : "border-transparent bg-brand-solid text-brand-solid-text"
            }`}
          >
            {published ? (
              <EyeOff className="size-4" strokeWidth={2} aria-hidden />
            ) : (
              <Eye className="size-4" strokeWidth={2} aria-hidden />
            )}
            {published ? dict.admin.changelogUnpublish : dict.admin.changelogPublish}
          </button>

          <Link
            href={`/${locale}/admin/changelog/${entry.id}`}
            aria-label={`${dict.admin.edit}: ${entry.title}`}
            className="inline-flex size-9 items-center justify-center rounded-control border border-border text-text-secondary transition-colors duration-(--dur-micro) hover:text-text"
          >
            <Pencil className="size-4" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </div>
    </li>
  );
}
