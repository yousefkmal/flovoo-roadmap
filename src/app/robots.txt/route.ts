import type { NextRequest } from "next/server";

import { AI_CRAWLERS } from "@/config/ai-crawlers";

/**
 * Explicit rules per bot, and a `Sitemap:` line for the host being asked.
 *
 * A blanket `User-agent: *` is ambiguous to several AI crawlers: some read the
 * wildcard block, some only obey a block naming them. Naming every one removes
 * the guesswork, and the file itself becomes a statement of intent — anyone
 * reading it can see that we want to be read.
 *
 * Training crawlers are allowed by decision (§10.1 of the Phase 7 brief): a
 * help center exists so that people, and the models they ask, know the answers.
 *
 * This is a route handler rather than Next's `robots.ts` because one app
 * serves two hosts. A sitemap advertised on a host it does not belong to is
 * cross-submission, which search engines ignore unless both hosts are verified
 * together — so `help.flovoo.com` must point at its own copy, not the
 * roadmap's. The bot list lives in `src/config/ai-crawlers.ts`.
 */

/** Never crawlable, whoever is asking: the admin, the API, and search results. */
const ALWAYS_DISALLOW = [
  "/ar/admin",
  "/en/admin",
  "/api/",
  "/ar/help/search",
  "/en/help/search",
  "/ar/search",
  "/en/search",
];

function block(userAgent: string): string {
  return [`User-agent: ${userAgent}`, "Allow: /", ...ALWAYS_DISALLOW.map((p) => `Disallow: ${p}`)].join("\n");
}

export function GET(request: NextRequest) {
  // The host that was asked, so each one advertises the sitemap it serves.
  const host = request.headers.get("host") ?? new URL(request.url).host;
  const proto = request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const body = [
    ...[ "*", ...AI_CRAWLERS.map((c) => c.token) ].map(block),
    "",
    `Sitemap: ${origin}/sitemap/ar.xml`,
    `Sitemap: ${origin}/sitemap/en.xml`,
    "",
  ].join("\n\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
