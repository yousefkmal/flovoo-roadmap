"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Highlighted } from "@/components/help/Highlighted";
import { useDismissable } from "@/components/ui/useDismissable";
import type { SnippetPart } from "@/lib/help/search";
import type { Locale } from "@/lib/types";

/**
 * The search box: a real GET form to the results page, so it works before any
 * script runs and a query is a shareable URL, with instant results layered on
 * top. Typing fetches after a short pause; the query the reader settles on is
 * logged once, with its result count, so the content-gap inbox sees what
 * people looked for and did not find. A result click is attributed to that
 * logged query on the way out.
 *
 * `hero` is the large field on the home page and carries the view's one
 * gradient CTA; `compact` sits centred in the header.
 */

export interface HelpSearchLabels {
  label: string;
  placeholder: string;
  button: string;
  searching: string;
  minLength: string;
  noMatches: string;
  viewAll: string;
  optionsLabel: string;
  /** "in {collection}" with the placeholder left in. */
  inCollection: string;
}

interface InstantResult {
  id: string;
  href: string;
  title: string;
  titleParts: SnippetPart[];
  collection: string;
  snippet: SnippetPart[];
}

interface InstantResponse {
  query: string;
  results: InstantResult[];
  viewAllHref: string;
}

const MIN_LENGTH = 2;
const FETCH_DELAY = 250;
const LOG_DELAY = 800;

export function HelpSearch({
  locale,
  variant,
  action,
  labels,
  initialQuery = "",
  className = "",
}: {
  locale: Locale;
  variant: "hero" | "compact";
  /** The results page; the form falls back to it and Enter goes there. */
  action: string;
  labels: HelpSearchLabels;
  initialQuery?: string;
  className?: string;
}) {
  const router = useRouter();
  const listId = useId();
  const inputId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(initialQuery);
  const [response, setResponse] = useState<InstantResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  /** The logged query and its row id; only used while the query still matches. */
  const [logged, setLogged] = useState<{ query: string; id: string | null } | null>(null);

  const close = useCallback(() => setOpen(false), []);
  useDismissable(open, wrapRef, close);

  const trimmed = query.trim();

  // Fetch instant results after a pause; abort anything still in flight.
  // Nothing is reset here: a response for another query is simply ignored by
  // the derived values below, so no state has to be cleared in the effect.
  useEffect(() => {
    if (trimmed.length < MIN_LENGTH) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url = `/api/help/search?locale=${locale}&q=${encodeURIComponent(trimmed)}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as InstantResponse;
        setResponse(data);
        setActiveIndex(-1);
      } catch {
        // Aborted or failed: the previous results stay until a newer response lands.
      }
    }, FETCH_DELAY);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, locale]);

  // Log the query the reader settled on, once results for it are known.
  useEffect(() => {
    if (!response || response.query !== trimmed || trimmed.length < MIN_LENGTH) return;
    const settled = trimmed;
    const count = response.results.length;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/help/search/log", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: settled, locale, resultsCount: count }),
        });
        if (res.ok) {
          const data = (await res.json()) as { queryId: string | null };
          setLogged({ query: settled, id: data.queryId });
        }
      } catch {
        // Logging is a side effect; the reader never waits on it.
      }
    }, LOG_DELAY);
    return () => clearTimeout(timer);
  }, [response, trimmed, locale]);

  const queryId = logged?.query === trimmed ? logged.id : null;
  const current = response?.query === trimmed ? response : null;
  const loading = trimmed.length >= MIN_LENGTH && current === null;

  function attributeClick(articleId: string) {
    if (!queryId) return;
    const payload = JSON.stringify({ queryId, articleId });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/help/search/click",
        new Blob([payload], { type: "application/json" }),
      );
    } else {
      void fetch("/api/help/search/click", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      });
    }
  }

  const results = current?.results ?? [];
  const showList = open && trimmed.length >= MIN_LENGTH;
  const optionId = (index: number) => `${listId}-option-${index}`;

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (results.length === 0) return;
      event.preventDefault();
      setOpen(true);
      const last = results.length - 1;
      setActiveIndex((index) =>
        event.key === "ArrowDown" ? (index >= last ? 0 : index + 1) : index <= 0 ? last : index - 1,
      );
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      const chosen = results[activeIndex];
      attributeClick(chosen.id);
      setOpen(false);
      router.push(chosen.href);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
  }

  const isHero = variant === "hero";

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <form
        role="search"
        action={action}
        method="get"
        onSubmit={() => setOpen(false)}
        className={
          isHero
            ? "flex h-12 items-center gap-2 rounded-control border border-border bg-card p-1 shadow-sm transition-[border-color,box-shadow] duration-(--dur-micro) focus-within:border-flovoo-blue focus-within:shadow-lg"
            : "relative"
        }
      >
        <label htmlFor={inputId} className="sr-only">
          {labels.label}
        </label>
        <Search
          className={
            isHero
              ? "ms-3 size-5 shrink-0 text-muted"
              : "pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          }
          strokeWidth={2}
          aria-hidden
        />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          name="q"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={labels.placeholder}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          className={
            isHero
              ? "h-full min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-placeholder focus-visible:outline-none"
              : "h-9 w-full rounded-control border border-border bg-card ps-9 pe-3 text-sm text-text outline-none transition-colors duration-(--dur-micro) placeholder:text-placeholder focus:border-flovoo-blue"
          }
        />
        {isHero ? (
          <button
            type="submit"
            className="gradient-brand inline-flex h-full shrink-0 items-center rounded-[8px] px-4 text-sm font-semibold text-white transition-opacity duration-(--dur-micro) hover:opacity-90"
          >
            {labels.button}
          </button>
        ) : null}
      </form>

      {showList ? (
        <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-card border border-border bg-card text-start shadow-lg">
          <ul id={listId} role="listbox" aria-label={labels.optionsLabel} className="max-h-[60vh] overflow-y-auto p-1.5">
            {results.map((result, index) => (
              <li
                key={result.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
              >
                <Link
                  href={result.href}
                  onClick={() => {
                    attributeClick(result.id);
                    setOpen(false);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`block rounded-control px-3 py-2 transition-colors duration-(--dur-micro) ${
                    index === activeIndex ? "bg-subtle" : "hover:bg-subtle"
                  }`}
                >
                  <span className="block text-sm font-semibold leading-5 text-text">
                    <Highlighted parts={result.titleParts} />
                  </span>
                  <span className="mt-0.5 block text-xs text-text-tertiary">
                    {labels.inCollection.replace("{collection}", result.collection)}
                  </span>
                  {result.snippet.length > 0 ? (
                    <span className="clamp-2 mt-1 block text-[13px] leading-5 text-text-secondary">
                      <Highlighted parts={result.snippet} />
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}

            {results.length === 0 ? (
              <li className="px-3 py-3 text-[13px] text-text-secondary" role="option" aria-selected={false} aria-disabled>
                {loading ? labels.searching : labels.noMatches}
              </li>
            ) : null}
          </ul>

          {results.length > 0 && current ? (
            <Link
              href={current.viewAllHref}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between border-t border-border px-4 py-2.5 text-sm font-semibold text-link transition-colors duration-(--dur-micro) hover:bg-subtle"
            >
              {labels.viewAll}
              <ArrowRight className="size-4 rtl:-scale-x-100" strokeWidth={2} aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
