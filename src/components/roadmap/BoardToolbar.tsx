"use client";

import { useCallback, useRef, useState } from "react";
import { Check, ListFilter, Search, X } from "lucide-react";

import { useDismissable } from "@/components/ui/useDismissable";
import type { Dictionary } from "@/i18n";

export interface CategoryOption {
  slug: string;
  name: string;
  color: string;
}

/**
 * Two controls, both collapsed to an icon until they are needed: search and the
 * category filter. Replacing the chip row with these keeps the eye on the board
 * — the filters were taking a full row and a lot of colour to say very little.
 *
 * Both behave the same at every width: press the icon, the control opens in
 * place; Escape or a press outside closes it. Nothing is hidden behind a
 * different interaction on mobile.
 */
export function BoardToolbar({
  dict,
  categories,
  query,
  onQueryChange,
  activeCategory,
  onCategoryChange,
}: {
  dict: Dictionary;
  categories: CategoryOption[];
  query: string;
  onQueryChange: (value: string) => void;
  activeCategory: string | null;
  onCategoryChange: (slug: string | null) => void;
}) {
  const active = categories.find((c) => c.slug === activeCategory) ?? null;

  return (
    <div className="flex shrink-0 items-center justify-end gap-2">
      <SearchControl dict={dict} query={query} onQueryChange={onQueryChange} />
      <CategoryControl
        dict={dict}
        categories={categories}
        active={active}
        onCategoryChange={onCategoryChange}
      />
    </div>
  );
}

const ICON_BUTTON =
  "inline-flex h-10 items-center justify-center gap-2 rounded-control border px-2.5 text-sm font-semibold transition-colors duration-(--dur-micro)";
const ICON_BUTTON_IDLE =
  "border-border bg-card text-text-secondary hover:text-text";
const ICON_BUTTON_ACTIVE =
  "border-flovoo-blue bg-info-tint text-info-label";

function SearchControl({
  dict,
  query,
  onQueryChange,
}: {
  dict: Dictionary;
  query: string;
  onQueryChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(
    (reason: "escape" | "outside") => {
      // A press outside leaves an active search alone — collapsing it would
      // hide the reason the board is filtered. Escape always clears.
      if (reason === "outside" && query.trim() !== "") return;
      if (reason === "escape") onQueryChange("");
      setOpen(false);
      if (reason === "escape") buttonRef.current?.focus();
    },
    [query, onQueryChange],
  );

  useDismissable(open, wrapRef, close);

  return (
    <div ref={wrapRef} className="flex items-center">
      {open ? (
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted"
            strokeWidth={2}
            aria-hidden
          />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={dict.filters.searchPlaceholder}
            aria-label={dict.filters.searchLabel}
            className="h-10 w-44 rounded-control border border-flovoo-blue bg-card ps-9 pe-9 text-sm text-text outline-none placeholder:text-placeholder sm:w-64"
          />
          <button
            type="button"
            onClick={() => {
              onQueryChange("");
              setOpen(false);
              buttonRef.current?.focus();
            }}
            aria-label={dict.filters.clearSearch}
            className="absolute top-1/2 end-1.5 -translate-y-1/2 rounded-input p-1.5 text-text-secondary transition-colors duration-(--dur-micro) hover:text-text"
          >
            <X className="size-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={dict.filters.searchLabel}
          className={`${ICON_BUTTON} ${query.trim() ? ICON_BUTTON_ACTIVE : ICON_BUTTON_IDLE}`}
        >
          <Search className="size-5" strokeWidth={2} aria-hidden />
        </button>
      )}
    </div>
  );
}

function CategoryControl({
  dict,
  categories,
  active,
  onCategoryChange,
}: {
  dict: Dictionary;
  categories: CategoryOption[];
  active: CategoryOption | null;
  onCategoryChange: (slug: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback((reason: "escape" | "outside") => {
    setOpen(false);
    if (reason === "escape") buttonRef.current?.focus();
  }, []);

  useDismissable(open, wrapRef, close);

  function select(slug: string | null) {
    onCategoryChange(slug);
    setOpen(false);
    buttonRef.current?.focus();
  }

  /** Up/Down move through the options, the way a menu is expected to behave. */
  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    const next = items[(index + step + items.length) % items.length];
    next?.focus();
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={dict.filters.categoryLabel}
        className={`${ICON_BUTTON} ${active ? ICON_BUTTON_ACTIVE : ICON_BUTTON_IDLE}`}
      >
        <ListFilter className="size-5" strokeWidth={2} aria-hidden />
        {active ? (
          <span className="hidden max-w-32 truncate sm:inline">{active.name}</span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={dict.filters.categoryLabel}
          onKeyDown={onMenuKeyDown}
          className="absolute top-full end-0 z-30 mt-2 w-56 overflow-hidden rounded-card border border-border bg-card p-1.5 shadow-lg"
        >
          <MenuOption
            label={dict.filters.allCategories}
            selected={active === null}
            onSelect={() => select(null)}
            autoFocus={active === null}
          />
          <div className="my-1.5 border-t border-border" />
          {categories.map((category) => (
            <MenuOption
              key={category.slug}
              label={category.name}
              color={category.color}
              selected={active?.slug === category.slug}
              onSelect={() => select(category.slug)}
              autoFocus={active?.slug === category.slug}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MenuOption({
  label,
  color,
  selected,
  onSelect,
  autoFocus,
}: {
  label: string;
  color?: string;
  selected: boolean;
  onSelect: () => void;
  autoFocus?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      autoFocus={autoFocus}
      onClick={onSelect}
      className={`flex w-full items-center gap-2 rounded-input px-2.5 py-2 text-start text-sm transition-colors duration-(--dur-micro) ${
        selected ? "bg-subtle font-semibold text-text" : "text-text-secondary hover:bg-subtle hover:text-text"
      }`}
    >
      {color ? (
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : (
        <span aria-hidden className="size-2 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {selected ? (
        <Check className="size-4 shrink-0 text-flovoo-blue" strokeWidth={2.5} aria-hidden />
      ) : null}
    </button>
  );
}
