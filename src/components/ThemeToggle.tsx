"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import { useDismissable } from "@/components/ui/useDismissable";
import {
  DEFAULT_THEME,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  isThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const ICONS: Record<ThemePreference, LucideIcon> = {
  auto: Monitor,
  light: Sun,
  dark: Moon,
};

/** Fired on this tab when the preference changes; `storage` only fires on others. */
const CHANGE_EVENT = "flovoo:themechange";

/**
 * The stored preference read as an external store rather than copied into state
 * in an effect — that keeps the server snapshot honest and the tab in step with
 * changes made in another one.
 */
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_THEME;
  } catch {
    // Storage is unavailable in some privacy modes; the default is a fine answer.
    return DEFAULT_THEME;
  }
}

function serverPreference(): ThemePreference {
  return DEFAULT_THEME;
}

function systemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(preference: ThemePreference) {
  document.documentElement.dataset.theme =
    preference === "auto" ? systemTheme() : preference;
}

/**
 * Theme control: auto, light or dark, with auto as the default.
 *
 * The attribute on <html> is already correct before this mounts — the inline
 * script in the layout sets it — so this only reads the preference back and
 * writes new ones. While on auto it also follows the OS if that changes
 * mid-session.
 */
export function ThemeToggle({
  label,
  optionLabels,
}: {
  label: string;
  optionLabels: Record<ThemePreference, string>;
}) {
  const preference = useSyncExternalStore(
    subscribe,
    readPreference,
    serverPreference,
  );

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // On auto the OS is the source of truth, and it can change while the page is
  // open. This only writes to the DOM, so there is no state to cascade.
  useEffect(() => {
    if (preference !== "auto") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => apply("auto");
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [preference]);

  const close = useCallback((reason: "escape" | "outside") => {
    setOpen(false);
    if (reason === "escape") buttonRef.current?.focus();
  }, []);

  useDismissable(open, wrapRef, close);

  function select(next: ThemePreference) {
    apply(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Not persisting is survivable; the choice still applies to this page.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    items[(index + step + items.length) % items.length]?.focus();
  }

  const Icon = ICONS[preference];

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${optionLabels[preference]}`}
        className="inline-flex size-9 items-center justify-center rounded-control border border-border bg-card text-text-secondary transition-colors duration-(--dur-micro) hover:text-text"
      >
        <Icon className="size-5" strokeWidth={2} aria-hidden />
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className="absolute top-full end-0 z-30 mt-2 w-44 overflow-hidden rounded-card border border-border bg-card p-1.5 shadow-lg"
        >
          {THEME_PREFERENCES.map((option) => {
            const OptionIcon = ICONS[option];
            const selected = preference === option;
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                autoFocus={selected}
                onClick={() => select(option)}
                className={`flex w-full items-center gap-2 rounded-input px-2.5 py-2 text-start text-sm transition-colors duration-(--dur-micro) ${
                  selected
                    ? "bg-subtle font-semibold text-text"
                    : "text-text-secondary hover:bg-subtle hover:text-text"
                }`}
              >
                <OptionIcon className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{optionLabels[option]}</span>
                {selected ? (
                  <Check
                    className="size-4 shrink-0 text-flovoo-blue"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
