import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";

const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

/**
 * Where Google and the email link come back to.
 *
 * Two arrivals are accepted, because they fail in different places.
 *
 * `code` is the PKCE exchange. It is what Google uses, and it is bound to a
 * verifier cookie held by the browser that started the sign-in — so a link
 * opened anywhere else, another browser profile or a phone, cannot complete it.
 *
 * `token_hash` is the cross-device path. It carries no browser-side secret, so
 * a link requested on a laptop still works when it is opened on a phone. Point
 * the Supabase email template at it to get that behaviour.
 *
 * `next` carries the page the person was on, and is checked to be a local path
 * — an open redirect here would be a phishing vector.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type") ?? "";
  const rawNext = searchParams.get("next") ?? "";
  const localeSegment = request.nextUrl.pathname.split("/")[1];
  const locale = isLocale(localeSegment) ? localeSegment : DEFAULT_LOCALE;

  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : `/${locale}`;

  // Supabase reports a rejected link in the query rather than sending a code.
  const providerError = searchParams.get("error_code") ?? searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(
      `${origin}${next}?auth=${encodeURIComponent(providerError)}`,
    );
  }

  if (!code && !tokenHash) {
    return NextResponse.redirect(`${origin}${next}?auth=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}${next}?auth=unconfigured`);
  }

  const { error } = tokenHash
    ? await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: OTP_TYPES.has(rawType as EmailOtpType)
          ? (rawType as EmailOtpType)
          : "email",
      })
    : await supabase.auth.exchangeCodeForSession(code!);

  if (error) {
    console.error("[flovoo] auth callback failed", {
      via: tokenHash ? "token_hash" : "code",
      status: error.status,
      message: error.message,
    });
    return NextResponse.redirect(`${origin}${next}?auth=failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
