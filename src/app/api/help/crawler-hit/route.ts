import { NextResponse, type NextRequest } from "next/server";

import { isLocale } from "@/i18n/config";
import { getHelpArticleBySlug } from "@/lib/data/help-repository";
import { noteCrawlerHit } from "@/lib/help/crawler-log";
import { decodeSlug } from "@/lib/help/paths";

/**
 * Records that an AI system fetched a help page.
 *
 * Article pages are static, so nothing runs per request on the page itself —
 * `proxy.ts` spots the crawler and calls this. It lives in the Node runtime
 * because verifying a crawler means reverse DNS, which the edge cannot do.
 *
 * Not a public endpoint in any meaningful sense: it writes a counter row and
 * returns nothing. The shared secret only stops it being trivially spammed.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_LOG_SECRET;
  if (secret && request.headers.get("x-internal-log") !== secret) {
    return new NextResponse(null, { status: 204 });
  }

  let body: { userAgent?: string; path?: string; ip?: string };
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  if (!body.path) return new NextResponse(null, { status: 204 });

  // Resolve the article so the dashboard can rank pages, not just paths.
  let articleId: string | null = null;
  let language: "ar" | "en" | null = null;
  const match = body.path.match(/^\/(ar|en)(?:\/help)?\/articles\/([^/?#]+?)(?:\.md)?$/);
  if (match && isLocale(match[1])) {
    language = match[1];
    const article = await getHelpArticleBySlug(language, decodeSlug(match[2]));
    articleId = article?.id ?? null;
  }

  await noteCrawlerHit({
    userAgent: body.userAgent ?? null,
    ip: body.ip ?? null,
    path: body.path,
    status: 200,
    articleId,
    language,
  });

  return new NextResponse(null, { status: 204 });
}
