"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { CollectionIcon } from "@/components/help/CollectionIcon";
import { t } from "@/i18n";
import { helpArticleHref, helpCollectionHref } from "@/lib/help/paths";
import type { HelpNavActive, HelpNavCollection } from "@/lib/help/types";
import type { Locale } from "@/lib/types";

/**
 * The topic tree that follows the reader on every help page. Each topic row
 * is a plain-text link to its category; the chevron beside it opens the
 * topic's articles in place without navigating. Articles carry the icons —
 * the level the eye scans when looking for a specific page. The topic the
 * reader is in starts open and its article is highlighted, so the tree always
 * shows where they are.
 *
 * One component serves both the desktop column and the mobile drawer; the
 * drawer passes `onNavigate` so it can close itself when a link is followed.
 */
export interface HelpSidebarLabels {
  nav: string;
  expand: string;
  collapse: string;
}

export function HelpSidebarNav({
  locale,
  collections,
  active,
  labels,
  onNavigate,
}: {
  locale: Locale;
  collections: HelpNavCollection[];
  active: HelpNavActive;
  labels: HelpSidebarLabels;
  onNavigate?: () => void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(active.collectionId ? [active.collectionId] : []),
  );

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <nav aria-label={labels.nav} className="text-sm">
      <ul className="flex flex-col gap-0.5">
        {collections.map((collection) => {
          const isActiveTopic = collection.id === active.collectionId;
          const isOpen = expanded.has(collection.id);
          const listId = `help-nav-${collection.id}`;

          return (
            <li key={collection.id}>
              <div
                className={`flex items-center rounded-control transition-colors duration-(--dur-micro) ${
                  isActiveTopic && !active.articleId
                    ? "bg-info-tint text-link"
                    : "text-text hover:bg-subtle"
                }`}
              >
                <Link
                  href={helpCollectionHref(locale, collection.slug)}
                  onClick={onNavigate}
                  aria-current={isActiveTopic && !active.articleId ? "page" : undefined}
                  className="flex min-w-0 flex-1 items-center rounded-control px-3 py-1.5 font-semibold"
                >
                  <span className="truncate">{collection.name}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => toggle(collection.id)}
                  aria-expanded={isOpen}
                  aria-controls={listId}
                  aria-label={t(isOpen ? labels.collapse : labels.expand, {
                    name: collection.name,
                  })}
                  className="me-1 inline-flex size-7 shrink-0 items-center justify-center rounded-input text-muted transition-colors duration-(--dur-micro) hover:text-text"
                >
                  <ChevronDown
                    className={`size-4 transition-transform duration-(--dur-standard) ease-(--ease-expo) ${
                      isOpen ? "" : "ltr:-rotate-90 rtl:rotate-90"
                    }`}
                    strokeWidth={2}
                    aria-hidden
                  />
                </button>
              </div>

              <ul
                id={listId}
                hidden={!isOpen}
                className="ms-3 mt-0.5 flex flex-col gap-px border-s border-border ps-1"
              >
                {collection.articles.map((article) => {
                  const isCurrent = article.id === active.articleId;
                  return (
                    <li key={article.id}>
                      <Link
                        href={helpArticleHref(locale, article.slug)}
                        onClick={onNavigate}
                        aria-current={isCurrent ? "page" : undefined}
                        className={`flex items-start gap-2 rounded-input px-3 py-1.5 text-[13px] leading-snug transition-colors duration-(--dur-micro) ${
                          isCurrent
                            ? "bg-info-tint font-semibold text-link"
                            : "text-text-secondary hover:bg-subtle hover:text-text"
                        }`}
                      >
                        <CollectionIcon
                          name={article.icon}
                          className={`mt-px size-3.5 shrink-0 ${isCurrent ? "text-link" : "text-muted"}`}
                        />
                        <span className="min-w-0">{article.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
