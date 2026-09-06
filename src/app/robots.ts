import type { MetadataRoute } from "next";

import { AI_CRAWLERS } from "@/config/ai-crawlers";
import { absoluteUrl } from "@/lib/help/seo";

/**
 * Explicit rules per bot, not one blanket rule.
 *
 * A blanket `User-agent: *` is ambiguous to several AI crawlers: some read the
 * wildcard block, some only obey a block naming them. Naming every one removes
 * the guesswork, and it makes the file itself a statement of intent — anyone
 * reading it can see we want to be read.
 *
 * Training crawlers are allowed by decision (§10.1 of the Phase 7 brief): a
 * help center exists so that people, and the models they ask, know the answers.
 *
 * The bot list lives in `src/config/ai-crawlers.ts`; adding one there adds it
 * here. `npm test` fails if a search-class bot ever ends up disallowed.
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

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Everyone not named below.
      { userAgent: "*", allow: "/", disallow: ALWAYS_DISALLOW },
      // Every AI system we know of, named, so none of them has to infer.
      ...AI_CRAWLERS.map((crawler) => ({
        userAgent: crawler.token,
        allow: "/",
        disallow: ALWAYS_DISALLOW,
      })),
    ],
    sitemap: [absoluteUrl("/sitemap/ar.xml"), absoluteUrl("/sitemap/en.xml")],
  };
}
