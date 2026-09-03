/**
 * Theme preference: what the visitor asked for, which is not the same as the
 * theme that ends up on screen. `auto` defers to the operating system and is
 * the default — the portal follows the OS until someone says otherwise.
 */
export const THEME_PREFERENCES = ["auto", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "flovoo-theme";
export const DEFAULT_THEME: ThemePreference = "auto";

export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === "string" &&
    (THEME_PREFERENCES as readonly string[]).includes(value)
  );
}

/**
 * Runs before first paint, inlined into <head>, so the page never renders in
 * one theme and then flips. Deliberately dependency-free and defensive:
 * localStorage throws in some privacy modes, and a broken toggle must not take
 * the page down with it.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var k=${JSON.stringify(THEME_STORAGE_KEY)};
var p=localStorage.getItem(k);
if(p!=="light"&&p!=="dark"&&p!=="auto")p=${JSON.stringify(DEFAULT_THEME)};
var t=p==="auto"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;
document.documentElement.dataset.theme=t;
}catch(e){document.documentElement.dataset.theme="light"}})()`;
