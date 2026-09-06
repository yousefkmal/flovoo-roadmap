import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, isLocale, type Locale } from "@/i18n/config";
import { HELP_SEGMENT, helpHost } from "@/lib/help/paths";

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

/** The locale segment of a prefixed path, or null for a bare one. */
function localeOf(pathname: string) {
  return (
    LOCALES.find(
      (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
    ) ?? null
  );
}

/**
 * Whether this request arrived on the help center's own host. The help center
 * is the same app served from `help.flovoo.com`; nothing else about the request
 * distinguishes it, so the host is the switch.
 */
function isHelpHost(request: NextRequest) {
  const expected = helpHost();
  if (!expected) return false;
  const host = request.headers.get("host")?.split(":")[0].toLowerCase();
  return host === expected;
}

/** Routes that keep their own paths on the help host: sign-in and the admin. */
const HELP_HOST_PASSTHROUGH = ["auth", "admin", HELP_SEGMENT];

/**
 * `<article-url>.md`, and `Accept: text/markdown` on the article itself, both
 * mean "give me the plain text". Both are answered by one route handler.
 *
 * Matching here rather than adding a route keeps the public address exactly
 * the article's own with `.md` appended, which is the shape agents expect.
 */
function markdownRewrite(request: NextRequest, locale: Locale, publicPath: string): URL | null {
  const article = publicPath.match(/^\/articles\/([^/?#]+?)(\.md)?$/);
  if (!article) return null;

  const explicit = Boolean(article[2]);
  const accept = request.headers.get("accept") ?? "";
  // Only when Markdown is asked for ahead of HTML; a browser sends both.
  const negotiated = /text\/markdown/i.test(accept) && !/text\/html/i.test(accept);
  if (!explicit && !negotiated) return null;

  const url = request.nextUrl.clone();
  url.pathname = `/api/help/markdown/${locale}/${article[1]}`;
  return url;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const locale = localeOf(pathname);

  if (!locale) {
    const resolved = resolveLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${resolved}${pathname === "/" ? "" : pathname}`;
    url.search = search;
    return NextResponse.redirect(url);
  }

  if (isHelpHost(request)) {
    const rest = pathname.slice(`/${locale}`.length); // "" or "/articles/…"
    const first = rest.split("/")[1] ?? "";

    // `/ar/help/…` is the internal shape; on the public host the canonical
    // address has no prefix, so send anyone who lands there to it.
    if (first === HELP_SEGMENT) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}${rest.slice(`/${HELP_SEGMENT}`.length)}`;
      url.search = search;
      return NextResponse.redirect(url, 308);
    }

    const markdown = markdownRewrite(request, locale, rest);
    if (markdown) return NextResponse.rewrite(markdown);

    if (!HELP_HOST_PASSTHROUGH.includes(first)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/${HELP_SEGMENT}${rest}`;
      return NextResponse.rewrite(url);
    }
  }

  // The same two addresses on the roadmap host, where help lives under /help.
  const internal = pathname.slice(`/${locale}`.length);
  if (internal.startsWith(`/${HELP_SEGMENT}/`)) {
    const markdown = markdownRewrite(request, locale, internal.slice(`/${HELP_SEGMENT}`.length));
    if (markdown) return NextResponse.rewrite(markdown);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, the API surface, and static assets —
  // but `.md` article addresses are ours, so they must not look like assets.
  matcher: ["/((?!_next|api|.*\\.(?!md$)[\\w]+$).*)"],
};
