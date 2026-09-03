import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";

/**
 * Where Google and the email link come back to.
 *
 * Supabase hands over a one-time `code`; exchanging it is what sets the session
 * cookies. `next` carries the page the person was on when they signed in, and is
 * checked to be a local path — an open redirect here would be a phishing vector.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "";
  const localeSegment = request.nextUrl.pathname.split("/")[1];
  const locale = isLocale(localeSegment) ? localeSegment : DEFAULT_LOCALE;

  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : `/${locale}`;

  if (!code) {
    return NextResponse.redirect(`${origin}${next}?auth=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}${next}?auth=unconfigured`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[flovoo] auth callback failed", error);
    return NextResponse.redirect(`${origin}${next}?auth=failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
