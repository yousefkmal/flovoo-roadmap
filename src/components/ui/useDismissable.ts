"use client";

import { useEffect, type RefObject } from "react";

/**
 * Closes a popover on Escape or on a pointer press outside it, and hands focus
 * back to the control that opened it. Shared by the search and filter controls
 * so both behave identically.
 */
export function useDismissable(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onDismiss: (reason: "escape" | "outside") => void,
) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onDismiss("escape");
      }
    }

    function onPointerDown(event: PointerEvent) {
      const node = ref.current;
      if (node && !node.contains(event.target as Node)) onDismiss("outside");
    }

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, ref, onDismiss]);
}
