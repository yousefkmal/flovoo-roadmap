import Link from "next/link";
import { Map } from "lucide-react";
import { Suspense } from "react";

import { FlovooLogo } from "@/components/FlovooLogo";
import { HelpMobileNav } from "@/components/help/HelpMobileNav";
import { HelpSearch } from "@/components/help/HelpSearch";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getDictionary } from "@/i18n";
import { helpSearchLabels } from "@/lib/help/labels";
import { helpHomeHref, helpSearchHref } from "@/lib/help/paths";
import type { HelpNavActive, HelpNavCollection } from "@/lib/help/types";
import { siteUrl } from "@/lib/site";
import type { Locale } from "@/lib/types";

/**
 * The help center's header, full width like the shell beneath it. Three
 * regions: the menu button (small screens) and lockup at the inline start,
 * the search field centred as the primary element, and theme, language and a
 * quiet link back to the roadmap at the inline end. No account menu — reading
 * help needs no session, which is also what keeps these pages static.
 *
 * `alternateHref` is where the other language's version of *this* page lives.
 * An article's slug differs per language, so the page decides, not the header.
 */
export function HelpHeader({
  locale,
  alternateHref,
  collections,
  active,
  showSearch = true,
}: {
  locale: Locale;
  alternateHref: string;
  collections: HelpNavCollection[];
  active: HelpNavActive;
  showSearch?: boolean;
}) {
  const dict = getDictionary(locale);
  const roadmapHref = new URL(`/${locale}`, siteUrl()).toString();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className="grid h-16 w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)_minmax(0,1fr)] lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <HelpMobileNav
            locale={locale}
            collections={collections}
            active={active}
            labels={{
              nav: dict.help.navLabel,
              expand: dict.help.expandTopic,
              collapse: dict.help.collapseTopic,
              open: dict.help.menuOpen,
              close: dict.help.menuClose,
            }}
          />
          <Link
            href={helpHomeHref(locale)}
            className="flex shrink-0 items-center gap-2.5 rounded-control"
            aria-label={dict.help.name}
          >
            <FlovooLogo name={dict.site.name} />
            <span className="hidden rounded-control bg-subtle px-2 py-1 text-xs font-semibold text-text-secondary sm:inline">
              {dict.help.badge}
            </span>
          </Link>
        </div>

        <div className="hidden min-w-0 justify-self-center md:block md:w-full">
          {showSearch ? (
            <HelpSearch
              locale={locale}
              variant="compact"
              action={helpSearchHref(locale)}
              labels={helpSearchLabels(dict)}
              className="w-full"
            />
          ) : null}
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <ThemeToggle
            label={dict.theme.label}
            optionLabels={{
              auto: dict.theme.auto,
              light: dict.theme.light,
              dark: dict.theme.dark,
            }}
          />

          {/* Reads the query string, so it needs its own boundary to keep the
              page prerenderable. */}
          <Suspense
            fallback={<div className="h-8 w-[4.75rem] rounded-pill border border-border" />}
          >
            <LanguageSwitcher
              locale={locale}
              label={dict.language.label}
              switchLabel={dict.language.switchTo}
              href={alternateHref}
            />
          </Suspense>

          <a
            href={roadmapHref}
            className="hidden h-9 items-center gap-2 rounded-control border border-border px-3 text-sm font-semibold text-text-secondary transition-colors duration-(--dur-micro) hover:text-text lg:inline-flex"
            hrefLang={locale}
          >
            <Map className="size-4" strokeWidth={2} aria-hidden />
            {dict.help.roadmapLink}
          </a>
        </div>
      </div>
    </header>
  );
}
