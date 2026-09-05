import { NextResponse, type NextRequest } from "next/server";

import { recordHelpSearchClick } from "@/lib/data/help-mutations";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Attributes a result click to a logged query — the numerator of the
 * search-to-click rate on the analytics dashboard. Sent as a beacon on the
 * way out, so it must never block or fail loudly.
 */
export async function POST(request: NextRequest) {
  let body: { queryId?: unknown; articleId?: unknown };
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const { queryId, articleId } = body;
  if (typeof queryId === "string" && typeof articleId === "string" && UUID.test(queryId) && UUID.test(articleId)) {
    await recordHelpSearchClick(queryId, articleId);
  }

  return new NextResponse(null, { status: 204 });
}
