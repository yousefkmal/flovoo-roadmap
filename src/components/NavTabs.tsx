"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, Megaphone } from "lucide-react";

import type { Locale } from "@/i18n/config";

/**
 * The portal's two faces: the board and the changelog. Rendered as a real tab
 * list so the active page is announced, not just underlined.
 */
export function NavTabs({
  locale,
  labels,
}: {
  locale: Locale;
  labels: { roadmap: string; updates: string };
}) {
  const pathname = usePathname();
  const tabs = [
    { key: "roadmap", href: `/${locale}`, label: labels.roadmap, Icon: Map },
    {
      key: "updates",
      href: `/${locale}/updates`,
      label: labels.updates,
      Icon: Megaphone,
    },
  ] as const;

  return (
    <nav
      aria-label={labels.roadmap}
      className="no-scrollbar -mb-px flex items-center gap-1 overflow-x-auto"
    >
      {tabs.map(({ key, href, label, Icon }) => {
        const isActive =
          key === "roadmap" ? pathname === `/${locale}` : pathname.startsWith(href);

        return (
          <Link
            key={key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 pb-3 pt-2 text-sm font-semibold transition-colors duration-(--dur-micro) ${
              isActive
                ? "border-flovoo-blue text-link"
                : "border-transparent text-text-secondary hover:text-text"
            }`}
          >
            <Icon className="size-5" strokeWidth={2} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
