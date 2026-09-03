"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_LABEL,
  LOCALE_SHORT_LABEL,
  LOCALES,
  otherLocale,
  type Locale,
} from "@/i18n/config";

/**
 * Swaps only the locale segment and carries the query string over untouched.
 * Because the board keeps its search, category, sort and open item in the URL,
 * switching language lands the visitor exactly where they were.
 */
export function LanguageSwitcher({
  locale,
  label,
  switchLabel,
}: {
  locale: Locale;
  label: string;
  switchLabel: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const target = otherLocale(locale);

  const rest = pathname.split("/").slice(2).join("/");
  const query = searchParams.toString();
  const href = `/${target}${rest ? `/${rest}` : ""}${query ? `?${query}` : ""}`;

  function persist() {
    document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  }

  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center rounded-pill border border-border bg-card p-0.5"
    >
      {LOCALES.map((option) =>
        option === locale ? (
          <span
            key={option}
            aria-current="true"
            lang={option}
            className="rounded-pill bg-subtle px-2.5 py-1 text-xs font-bold text-text"
          >
            {LOCALE_SHORT_LABEL[option]}
          </span>
        ) : (
          <Link
            key={option}
            href={href}
            hrefLang={option}
            lang={option}
            onClick={persist}
            title={LOCALE_LABEL[option]}
            aria-label={switchLabel}
            className="rounded-pill px-2.5 py-1 text-xs font-bold text-text-secondary transition-colors duration-(--dur-micro) hover:text-text"
          >
            {LOCALE_SHORT_LABEL[option]}
          </Link>
        ),
      )}
    </div>
  );
}
