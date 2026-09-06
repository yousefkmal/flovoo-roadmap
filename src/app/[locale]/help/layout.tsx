import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/help/JsonLd";
import { isLocale } from "@/i18n/config";
import { organizationJsonLd } from "@/lib/help/seo";

/**
 * Scopes the help center's text tokens (see `.help-surface` in globals.css)
 * without touching the roadmap's. `display: contents` keeps the body's flex
 * column intact — the wrapper exists only to carry the custom properties.
 *
 * It also emits the Organization node once per help page. AI systems favour
 * sources whose identity is unambiguous, and a single node with a stable `@id`
 * is what lets the author of an article, the publisher of the site and the
 * subject of the about page resolve to one entity rather than three
 * lookalikes. Every other node references that id instead of repeating it.
 */
export default async function HelpLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <div className="help-surface contents">
      <JsonLd data={organizationJsonLd(locale)} />
      {children}
    </div>
  );
}
