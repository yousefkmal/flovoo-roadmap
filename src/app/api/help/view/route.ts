import { createHash } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { isLocale } from "@/i18n/config";
import { localRecordView } from "@/lib/data/help-local-store";
import { getServiceSupabase } from "@/lib/data/supabase-admin";
import { getSupabase } from "@/lib/data/supabase";
import { ipHashFrom } from "@/lib/help/request";
import { takeToken } from "@/lib/rate-limit";

/**
 * Records that an article was read. Article pages are static, so the count
 * cannot happen during render — the page beacons here once per session.
 *
 * Privacy-light by construction (brief §9): the session id is a random value
 * the browser makes and forgets when the tab closes, hashed again here, and
 * the referrer is reduced to a hostname. No address, no user agent, no PII.
 */

const PER_IP = { limit: 120, windowMs: 60_000 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only the host, and only when it is somebody else's. */
function referrerDomain(raw: unknown, self: string): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host && host !== self ? host.slice(0, 120) : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let body: { articleId?: unknown; locale?: unknown; session?: unknown; referrer?: unknown };
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const { articleId, locale, session } = body;
  if (typeof articleId !== "string" || !UUID.test(articleId) || !isLocale(locale)) {
    return new NextResponse(null, { status: 204 });
  }

  const ipHash = ipHashFrom(request.headers);
  if (ipHash && !takeToken({ key: `help:view:${ipHash}`, ...PER_IP })) {
    return new NextResponse(null, { status: 204 });
  }

  const sessionHash = createHash("sha256")
    .update(`view:${typeof session === "string" ? session : (ipHash ?? "anonymous")}`)
    .digest("hex");
  const row = {
    article_id: articleId,
    language: locale,
    session_hash: sessionHash,
    referrer_domain: referrerDomain(body.referrer, request.nextUrl.hostname),
  };

  const supabase = getServiceSupabase() ?? getSupabase();
  if (supabase) {
    const { error } = await supabase.from("help_article_views").insert(row);
    if (error) console.warn(`help views: could not record: ${error.message}`);
  } else {
    localRecordView({
      articleId,
      language: locale,
      viewedAt: new Date().toISOString(),
      sessionHash,
    });
  }

  return new NextResponse(null, { status: 204 });
}
