"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Highlighted } from "@/components/help/Highlighted";
import type { SnippetPart } from "@/lib/help/search";

export interface SearchResultItem {
  id: string;
  href: string;
  titleParts: SnippetPart[];
  collection: string;
  snippet: SnippetPart[];
}

/**
 * The results page's list. A client component only so a click can be
 * attributed to the logged query as a beacon on the way out; the ranking and
 * snippets are all server work.
 */
export function SearchResultList({
  results,
  queryId,
  inCollectionLabel,
}: {
  results: SearchResultItem[];
  queryId: string | null;
  inCollectionLabel: string;
}) {
  function attribute(articleId: string) {
    if (!queryId) return;
    const payload = new Blob([JSON.stringify({ queryId, articleId })], {
      type: "application/json",
    });
    if (!navigator.sendBeacon?.("/api/help/search/click", payload)) {
      void fetch("/api/help/search/click", { method: "POST", body: payload, keepalive: true });
    }
  }

  return (
    <ol className="flex flex-col gap-2.5">
      {results.map((result) => (
        <li key={result.id}>
          <Link
            href={result.href}
            onClick={() => attribute(result.id)}
            className="group flex items-start gap-3 rounded-card border border-border bg-card px-4 py-3 transition-[border-color,box-shadow] duration-(--dur-micro) hover:border-flovoo-blue/40 hover:shadow-sm"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-5 text-text group-hover:text-link">
                <Highlighted parts={result.titleParts} />
              </span>
              <span className="mt-0.5 block text-xs text-text-tertiary">
                {inCollectionLabel.replace("{collection}", result.collection)}
              </span>
              {result.snippet.length > 0 ? (
                <span className="clamp-2 mt-1 block text-[13px] leading-5 text-text-secondary">
                  <Highlighted parts={result.snippet} />
                </span>
              ) : null}
            </span>
            <ChevronRight
              className="mt-0.5 size-4 shrink-0 text-muted transition-transform duration-(--dur-micro) group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
              strokeWidth={2}
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ol>
  );
}
