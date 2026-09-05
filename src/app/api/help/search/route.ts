import { NextResponse, type NextRequest } from "next/server";

import { isLocale } from "@/i18n/config";
import { helpArticleHref, helpSearchHref } from "@/lib/help/paths";
import { ipHashFrom } from "@/lib/help/request";
import { MIN_QUERY_LENGTH, searchHelp } from "@/lib/help/search";
import { takeToken } from "@/lib/rate-limit";

/**
 * Instant results for the search box, as JSON. Not logged: the box calls this
 * on every pause while typing, and half-typed words are not what the
 * content-gap inbox should be reading. The box posts the settled query to
 * `./log` separately.
 */

const PER_IP = { limit: 120, windowMs: 60_000 };
const MAX_RESULTS = 6;

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const locale = request.nextUrl.searchParams.get("locale");
  if (!isLocale(locale)) {
    return NextResponse.json({ error: "locale" }, { status: 400 });
  }

  const ipHash = ipHashFrom(request.headers);
  if (ipHash && !takeToken({ key: `help:search-api:${ipHash}`, ...PER_IP })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json(
      { query: q, results: [], viewAllHref: helpSearchHref(locale) },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const { query, results } = await searchHelp(locale, q, MAX_RESULTS);

  return NextResponse.json(
    {
      query,
      results: results.map((result) => ({
        id: result.id,
        href: helpArticleHref(locale, result.slug),
        title: result.title,
        titleParts: result.titleParts,
        collection: result.collection.name,
        snippet: result.snippet,
      })),
      viewAllHref: `${helpSearchHref(locale)}?q=${encodeURIComponent(query)}`,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
