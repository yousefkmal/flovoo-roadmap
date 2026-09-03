"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Modal shell: overlay, entrance, scroll lock, Escape, a Tab trap, and focus
 * returned to whatever opened it.
 *
 * Extracted so the feature detail and the submission form share one
 * implementation — this is the part that is easy to get subtly wrong twice.
 */
export function Dialog({
  open,
  label,
  onClose,
  children,
  panelClassName = "",
  containerClassName = "",
  initialFocusRef,
}: {
  open: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
  containerClassName?: string;
  /** Where focus lands on open. Defaults to the first focusable element. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;

    const target =
      initialFocusRef?.current ??
      panelRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
    target?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      restoreFocusTo.current?.focus();
    };
  }, [open, onClose, initialFocusRef]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="dialog-root"
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain p-0 sm:p-6 lg:p-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="fixed inset-0 bg-flovoo-navy/55 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden
          />

          <div ref={panelRef} className={`relative mx-auto flex w-full ${containerClassName}`}>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={label}
              initial={{ opacity: 0, y: 12, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className={`min-h-full w-full min-w-0 overflow-hidden border-border bg-card shadow-lg sm:min-h-0 sm:rounded-control sm:border ${panelClassName}`}
            >
              {children}
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
