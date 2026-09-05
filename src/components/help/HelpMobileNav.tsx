"use client";

import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { HelpSidebarNav, type HelpSidebarLabels } from "@/components/help/HelpSidebarNav";
import type { HelpNavActive, HelpNavCollection } from "@/lib/help/types";
import type { Locale } from "@/lib/types";

/**
 * Below the desktop breakpoint the topic tree lives behind a menu button in
 * the header and opens as a drawer from the inline start — the side the
 * sidebar occupies on wide screens. A native <dialog> supplies the backdrop,
 * Escape and focus handling; the drawer closes itself after any navigation.
 */
export function HelpMobileNav({
  locale,
  collections,
  active,
  labels,
}: {
  locale: Locale;
  collections: HelpNavCollection[];
  active: HelpNavActive;
  labels: HelpSidebarLabels & { open: string; close: string };
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  // A route change means a link in the drawer was followed: put it away.
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={labels.open}
        aria-haspopup="dialog"
        className="inline-flex size-9 items-center justify-center rounded-control border border-border text-text-secondary transition-colors duration-(--dur-micro) hover:text-text lg:hidden"
      >
        <Menu className="size-5" strokeWidth={2} aria-hidden />
      </button>

      <dialog
        ref={dialogRef}
        aria-label={labels.nav}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="fixed inset-y-0 start-0 m-0 me-auto h-dvh max-h-dvh w-[min(20rem,85vw)] max-w-none overflow-y-auto border-e border-border bg-card p-0 text-text shadow-lg backdrop:bg-flovoo-navy/55 backdrop:backdrop-blur-[2px]"
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <span className="text-sm font-semibold text-text">{labels.nav}</span>
          <button
            type="button"
            onClick={close}
            aria-label={labels.close}
            className="inline-flex size-9 items-center justify-center rounded-control text-text-secondary transition-colors duration-(--dur-micro) hover:bg-subtle hover:text-text"
          >
            <X className="size-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="p-3">
          <HelpSidebarNav
            locale={locale}
            collections={collections}
            active={active}
            labels={labels}
            onNavigate={close}
          />
        </div>
      </dialog>
    </>
  );
}
