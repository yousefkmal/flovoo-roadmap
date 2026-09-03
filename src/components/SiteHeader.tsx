import { Suspense } from "react";

import { AccountMenu } from "@/components/account/AccountMenu";
import { FlovooLogo } from "@/components/FlovooLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NavTabs } from "@/components/NavTabs";
import { SubmitIdeaLauncher } from "@/components/submit/SubmitIdeaLauncher";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { SubmitCategory } from "@/components/submit/SubmitIdeaDialog";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { AppUser } from "@/lib/auth/session";

/**
 * A quiet header: lockup and controls on one row, the two tabs below.
 * The gradient appears exactly once per view — on the primary CTA — so the
 * board itself stays neutral and the eye goes to the content.
 */
export function SiteHeader({
  locale,
  categories,
  user,
  isAdmin = false,
  googleEnabled,
}: {
  locale: Locale;
  categories: SubmitCategory[];
  user: AppUser | null;
  isAdmin?: boolean;
  googleEnabled: boolean;
}) {
  const dict = getDictionary(locale);

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto w-full max-w-board px-5 lg:px-10">
        <div className="flex h-16 items-center justify-between gap-3">
          <FlovooLogo name={dict.site.name} />

          <div className="flex items-center gap-2">
            <ThemeToggle
              label={dict.theme.label}
              optionLabels={{
                auto: dict.theme.auto,
                light: dict.theme.light,
                dark: dict.theme.dark,
              }}
            />

            {/* Its own boundary: the switcher reads the query string, and
                without this the whole page would opt out of prerendering. */}
            <Suspense
              fallback={
                <div className="h-8 w-[4.75rem] rounded-pill border border-border" />
              }
            >
              <LanguageSwitcher
                locale={locale}
                label={dict.language.label}
                switchLabel={dict.language.switchTo}
              />
            </Suspense>

            {/* Both read the URL to come back to after a redirect. */}
            <Suspense fallback={<div className="h-9 w-24 rounded-control border border-border" />}>
              <AccountMenu
                user={user}
                isAdmin={isAdmin}
                locale={locale}
                dict={dict}
                googleEnabled={googleEnabled}
              />
            </Suspense>

            <Suspense fallback={<div className="h-10 w-10 rounded-control bg-subtle" />}>
              <SubmitIdeaLauncher
                locale={locale}
                dict={dict}
                categories={categories}
                signedIn={Boolean(user)}
                googleEnabled={googleEnabled}
                defaultName={user?.name ?? ""}
                accountEmail={user?.email ?? ""}
              />
            </Suspense>
          </div>
        </div>

        <NavTabs
          locale={locale}
          labels={{ roadmap: dict.nav.roadmap, updates: dict.nav.updates }}
        />
      </div>
    </header>
  );
}
