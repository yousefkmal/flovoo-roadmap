"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { BoardColumn } from "@/components/roadmap/BoardColumn";
import { BoardToolbar, type CategoryOption } from "@/components/roadmap/BoardToolbar";
import { FeatureModal } from "@/components/roadmap/FeatureModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { BOARD_STATUSES, type BoardStatus } from "@/lib/types";
import { t, type Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { FeatureView } from "@/lib/view";

/**
 * The board owns three pieces of state — search, category and the open item —
 * and keeps all of them in the query string. That is what makes the language
 * switch lossless: it only swaps the locale segment and the URL carries
 * everything else across.
 *
 * There is no sort control. The board has one order — pinned, then most voted,
 * then newest — except in Shipped, where recency is what a visitor is after.
 */
export function RoadmapBoard({
  heading,
  features,
  categories,
  dict,
  locale,
  googleEnabled,
}: {
  heading: ReactNode;
  features: FeatureView[];
  categories: CategoryOption[];
  dict: Dictionary;
  locale: Locale;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryParam = searchParams.get("q") ?? "";
  const activeCategory = searchParams.get("cat");
  const openId = searchParams.get("item");

  // The input stays instant; the URL catches up on the next render. When the
  // URL changes from the outside (back button, a language switch) the draft is
  // re-synced during render rather than in an effect.
  const [draftQuery, setDraftQuery] = useState(queryParam);
  const [syncedQuery, setSyncedQuery] = useState(queryParam);
  if (syncedQuery !== queryParam) {
    setSyncedQuery(queryParam);
    setDraftQuery(queryParam);
  }

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const commitQuery = useCallback(
    (value: string) => {
      setDraftQuery(value);
      setParams({ q: value });
    },
    [setParams],
  );

  const filtered = useMemo(() => {
    const needle = draftQuery.trim().toLowerCase();
    return features.filter((feature) => {
      if (activeCategory && feature.category?.slug !== activeCategory) return false;
      if (needle && !feature.haystack.includes(needle)) return false;
      return true;
    });
  }, [features, activeCategory, draftQuery]);

  const byStatus = useMemo(() => {
    const groups = {
      under_review: [] as FeatureView[],
      planned: [] as FeatureView[],
      in_progress: [] as FeatureView[],
      shipped: [] as FeatureView[],
    } satisfies Record<BoardStatus, FeatureView[]>;

    for (const feature of filtered) {
      const bucket = groups[feature.status as BoardStatus];
      if (bucket) bucket.push(feature);
    }

    // Pinned first, then most voted, then newest.
    const byVotes = (a: FeatureView, b: FeatureView) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (a.votes !== b.votes) return b.votes - a.votes;
      return b.createdAtMs - a.createdAtMs;
    };
    for (const status of ["under_review", "planned", "in_progress"] as const) {
      groups[status].sort(byVotes);
    }
    // Shipped reads by recency: once a thing exists, "when did it land" is the
    // question, not "how many people asked for it".
    groups.shipped.sort((a, b) => (b.shippedAtMs ?? 0) - (a.shippedAtMs ?? 0));

    return groups;
  }, [filtered]);

  /**
   * Previous/next walk the board in reading order — column by column, top to
   * bottom — so stepping through the modal matches what the eye just scanned.
   */
  const ordered = useMemo(
    () => BOARD_STATUSES.flatMap((status) => byStatus[status]),
    [byStatus],
  );

  const openIndex = ordered.findIndex((feature) => feature.id === openId);
  const openFeature = openIndex >= 0 ? ordered[openIndex] : null;

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        {heading}
        <BoardToolbar
          dict={dict}
          categories={categories}
          query={draftQuery}
          onQueryChange={commitQuery}
          activeCategory={activeCategory}
          onCategoryChange={(slug) => setParams({ cat: slug })}
        />
      </div>

      {filtered.length > 0 ? (
        // Stacked and full width on mobile. From md all four stages sit on a
        // single row — never some above and some below — and the row scrolls
        // sideways until xl, where they share the width.
        //
        // Two elements, not one: the outer div clips and scrolls, the inner
        // `inline-flex` row is free to size to its content. Making a single
        // element both the scroller and the flex row leaks the overflow onto
        // the page, which gives the whole document a horizontal scrollbar.
        <div className="mt-6 md:overflow-x-auto md:pb-2">
          <div className="flex flex-col gap-6 md:inline-flex md:w-full md:flex-row md:items-stretch md:gap-5">
            {BOARD_STATUSES.map((status) => (
              <BoardColumn
                key={status}
                status={status}
                features={byStatus[status]}
                dict={dict}
                locale={locale}
                googleEnabled={googleEnabled}
                onOpen={(id) => setParams({ item: id })}
              />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          className="mt-8"
          title={dict.filters.noResultsTitle}
          body={dict.filters.noResultsBody}
        />
      )}

      <p className="sr-only" aria-live="polite">
        {t(dict.filters.resultsSummary, {
          count: filtered.length,
          total: features.length,
        })}
      </p>

      <FeatureModal
        feature={openFeature}
        dict={dict}
        locale={locale}
        googleEnabled={googleEnabled}
        onClose={() => setParams({ item: null })}
        onPrev={
          openIndex > 0 ? () => setParams({ item: ordered[openIndex - 1].id }) : undefined
        }
        onNext={
          openIndex >= 0 && openIndex < ordered.length - 1
            ? () => setParams({ item: ordered[openIndex + 1].id })
            : undefined
        }
      />
    </>
  );
}
