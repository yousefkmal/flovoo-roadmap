import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, isLocale } from "@/i18n/config";

/**
 * Sends bare paths (`/`, `/changelog`, …) to a locale-prefixed one. The choice
 * is the visitor's saved cookie first, then their Accept-Language header, then
 * Arabic — which is the product default, not a fallback.
 */
function resolveLocale(request: NextRequest) {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;

  const header = request.headers.get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const tag = part.trim().split(";")[0].toLowerCase();
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }

  return DEFAULT_LOCALE;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const hasLocale = LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return NextResponse.next();

  const locale = resolveLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  url.search = search;

  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next internals, the API surface, and static assets.
  matcher: ["/((?!_next|api|.*\\.[\\w]+$).*)"],
};
