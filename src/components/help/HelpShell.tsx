import type { ReactNode } from "react";

import { HelpSidebarNav } from "@/components/help/HelpSidebarNav";
import { getDictionary } from "@/i18n";
import type { HelpNavActive, HelpNavCollection } from "@/lib/help/types";
import type { Locale } from "@/lib/types";

/**
 * The frame every help page renders inside: the persistent topic sidebar
 * anchored to the inline-start edge of the viewport — right in Arabic, left
 * in English — running the full height of the page, with the content area
 * taking the remaining width. Each page centres its own reading column inside
 * that area with its own max-width.
 *
 * Below `lg` the sidebar column disappears and the same tree is reached from
 * the header's menu button (`HelpMobileNav`).
 */
export function HelpShell({
  locale,
  collections,
  active,
  children,
}: {
  locale: Locale;
  collections: HelpNavCollection[];
  active: HelpNavActive;
  children: ReactNode;
}) {
  const dict = getDictionary(locale);

  return (
    <div className="flex w-full flex-1 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden border-e border-border bg-column lg:block">
        <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto px-3 py-5">
          <HelpSidebarNav
            locale={locale}
            collections={collections}
            active={active}
            labels={{
              nav: dict.help.navLabel,
              expand: dict.help.expandTopic,
              collapse: dict.help.collapseTopic,
            }}
          />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
