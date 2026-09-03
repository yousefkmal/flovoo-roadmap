"use client";

import { useEffect, useRef, useState } from "react";

/**
 * An entry's body, collapsed past a certain height with a fade and a
 * "Continue reading" control — the reference's treatment, and the thing that
 * keeps a page of long entries scannable.
 *
 * The measurement decides whether the control is needed at all: a short entry
 * renders plainly, with nothing to press.
 */
const COLLAPSED_HEIGHT = 260;

export function EntryBody({
  id,
  paragraphs,
  moreLabel,
}: {
  /** Unique per entry: this element is referenced by the collapse control. */
  id: string;
  paragraphs: string[];
  moreLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;

    // Re-measure on resize: the same text wraps differently at another width,
    // and an entry that needed the control on mobile may not on a desktop.
    const check = () => setOverflows(node.scrollHeight > COLLAPSED_HEIGHT + 24);
    check();

    const observer = new ResizeObserver(check);
    observer.observe(node);
    return () => observer.disconnect();
  }, [paragraphs]);

  const collapsed = overflows && !expanded;

  return (
    <div className="relative">
      <div
        ref={contentRef}
        id={id}
        className="flex flex-col gap-4 overflow-hidden text-sm/6 text-text-secondary"
        style={collapsed ? { maxHeight: COLLAPSED_HEIGHT } : undefined}
      >
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>

      {collapsed ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-controls={id}
          className="absolute inset-x-0 bottom-0 flex h-20 items-end justify-center bg-linear-to-t from-page via-page/90 to-transparent pb-1 text-sm font-semibold text-link"
        >
          {moreLabel}
        </button>
      ) : null}
    </div>
  );
}
