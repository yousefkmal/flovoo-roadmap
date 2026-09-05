import type { ReactNode } from "react";

/**
 * Scopes the help center's text tokens (see `.help-surface` in globals.css)
 * without touching the roadmap's. `display: contents` keeps the body's flex
 * column intact — the wrapper exists only to carry the custom properties.
 */
export default function HelpLayout({ children }: { children: ReactNode }) {
  return <div className="help-surface contents">{children}</div>;
}
