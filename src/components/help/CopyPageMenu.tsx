"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink, FileText } from "lucide-react";

import { ASSISTANT_TARGETS, assistantUrl } from "@/config/ai-crawlers";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/lib/types";

/**
 * "Copy page" beside the article title.
 *
 * Two audiences. A reader pasting the article into an assistant wants clean
 * Markdown, which is what `<url>.md` serves. A reader who would rather let the
 * assistant fetch it wants a link that opens the chat with the question ready.
 *
 * Every option is counted — not who clicked, only that the option was used —
 * so the AI Visibility dashboard can show which assistants our customers
 * actually reach for. The three chat options also cause a real fetch from
 * `ChatGPT-User` / `Claude-User` / `Perplexity-User`, which the crawler log
 * records as a live retrieval a moment later.
 */
export function CopyPageMenu({
  articleId,
  locale,
  markdownUrl,
  canonicalUrl,
  dict,
}: {
  articleId: string;
  locale: Locale;
  markdownUrl: string;
  canonicalUrl: string;
  dict: Dictionary;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const t = dict.help;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function count(target: string) {
    // Fire and forget: a tally must never delay what the reader asked for.
    void fetch("/api/help/assistant-click", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ articleId, language: locale, target }),
      keepalive: true,
    }).catch(() => undefined);
  }

  async function copyMarkdown() {
    count("copy");
    try {
      const response = await fetch(markdownUrl);
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; opening the file is the honest fallback.
      window.open(markdownUrl, "_blank", "noopener");
    }
    setOpen(false);
  }

  const itemClass =
    "flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm text-text transition-colors duration-(--dur-micro) hover:bg-subtle";

  return (
    <div ref={container} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border px-2.5 text-xs font-semibold text-text-secondary transition-colors duration-(--dur-micro) hover:text-text sm:px-3"
      >
        {copied ? (
          <Check className="size-3.5 shrink-0 text-success-label" strokeWidth={2.5} aria-hidden />
        ) : (
          <Copy className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
        )}
        {/* Icon only on the narrowest screens, where the title needs the room. */}
        <span className="hidden sm:inline">{copied ? t.copied : t.copyPage}</span>
        <ChevronDown className="size-3 shrink-0 opacity-60" strokeWidth={2.5} aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute inset-inline-end-0 top-full z-30 mt-1.5 w-60 overflow-hidden rounded-card border border-border bg-card py-1 shadow-lg"
        >
          <button type="button" role="menuitem" onClick={copyMarkdown} className={itemClass}>
            <Copy className="size-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
            {t.copyPage}
          </button>
          <a
            role="menuitem"
            href={markdownUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              count("markdown");
              setOpen(false);
            }}
            className={itemClass}
          >
            <FileText className="size-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
            {t.viewAsMarkdown}
          </a>
          <div className="my-1 border-t border-border" />
          {ASSISTANT_TARGETS.map((target) => (
            <a
              key={target.id}
              role="menuitem"
              href={assistantUrl(target, locale, canonicalUrl)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                count(target.id);
                setOpen(false);
              }}
              className={itemClass}
            >
              <ExternalLink className="size-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
              {t.openIn.replace("{name}", target.label)}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
