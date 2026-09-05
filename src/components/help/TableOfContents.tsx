"use client";

import { List } from "lucide-react";
import { useEffect, useState } from "react";

import type { TocEntry } from "@/lib/help/blocks";

/**
 * The article's on-page outline, built from the same heading ids the body
 * renders. The desktop rail is sticky and follows the reader: the active entry
 * is the last heading that has scrolled past the top offset, so it agrees
 * with what is on screen even when two short sections share the viewport.
 * On small screens the same list folds into a native <details>.
 */

/** Matches the header height plus the prose's `scroll-margin-block-start`. */
const TOP_OFFSET = 96;

function useActiveHeading(entries: TocEntry[]) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (entries.length === 0) return;
    const ids = entries.map((entry) => entry.id);
    let frame = 0;

    const update = () => {
      frame = 0;
      let current: string | null = null;
      for (const id of ids) {
        const element = document.getElementById(id);
        if (!element) continue;
        if (element.getBoundingClientRect().top - TOP_OFFSET <= 1) current = id;
        else break;
      }
      setActiveId(current ?? ids[0]);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [entries]);

  return activeId;
}

function TocList({
  entries,
  activeId,
  onNavigate,
}: {
  entries: TocEntry[];
  activeId: string | null;
  onNavigate?: () => void;
}) {
  return (
    <ol className="flex flex-col gap-0.5 border-s border-border">
      {entries.map((entry) => {
        const isActive = entry.id === activeId;
        return (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              onClick={onNavigate}
              aria-current={isActive ? "location" : undefined}
              className={`-ms-px block border-s-2 py-1 pe-2 text-[13px] leading-snug transition-colors duration-(--dur-micro) ${
                entry.level === 3 ? "ps-6" : "ps-3"
              } ${
                isActive
                  ? "border-flovoo-blue font-semibold text-link"
                  : "border-transparent text-text-secondary hover:text-text"
              }`}
            >
              {entry.text}
            </a>
          </li>
        );
      })}
    </ol>
  );
}

export function TableOfContents({
  entries,
  title,
  variant,
}: {
  entries: TocEntry[];
  title: string;
  /** `rail` is the sticky desktop column; `inline` is the mobile accordion. */
  variant: "rail" | "inline";
}) {
  const activeId = useActiveHeading(entries);
  const [open, setOpen] = useState(false);

  if (entries.length === 0) return null;

  if (variant === "inline") {
    return (
      <details
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        className="group rounded-card border border-border bg-card"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-text marker:hidden [&::-webkit-details-marker]:hidden">
          <List className="size-4 text-muted" strokeWidth={2} aria-hidden />
          {title}
        </summary>
        <div className="px-3.5 pb-3">
          <TocList entries={entries} activeId={activeId} onNavigate={() => setOpen(false)} />
        </div>
      </details>
    );
  }

  return (
    <nav aria-label={title} className="text-sm">
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-text-tertiary">
        <List className="size-4" strokeWidth={2} aria-hidden />
        {title}
      </p>
      <TocList entries={entries} activeId={activeId} />
    </nav>
  );
}
