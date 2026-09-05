import { NextResponse, type NextRequest } from "next/server";

import { isLocale } from "@/i18n/config";
import { MAX_QUERY_LENGTH, logHelpSearch } from "@/lib/data/help-mutations";
import { ipHashFrom } from "@/lib/help/request";

/**
 * Records a query the reader settled on in the search box, with how many
 * results it had. Zero-result entries are the content-gap inbox's raw
 * material. Returns the row id so a later click can be attributed to it.
 */
export async function POST(request: NextRequest) {
  let body: { query?: unknown; locale?: unknown; resultsCount?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  const locale = body.locale;
  const resultsCount =
    typeof body.resultsCount === "number" && Number.isFinite(body.resultsCount)
      ? Math.max(0, Math.floor(body.resultsCount))
      : 0;

  if (!isLocale(locale) || query.length < 2 || query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const queryId = await logHelpSearch({
    query,
    locale,
    resultsCount,
    ipHash: ipHashFrom(request.headers),
  });

  return NextResponse.json({ queryId }, { headers: { "cache-control": "no-store" } });
}
