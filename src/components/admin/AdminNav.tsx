"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, LayoutGrid, Megaphone } from "lucide-react";

import type { Locale } from "@/i18n/config";

/** The two admin surfaces, with the moderation queue carrying its backlog. */
export function AdminNav({
  locale,
  pending,
  labels,
}: {
  locale: Locale;
  pending: number;
  labels: { board: string; submissions: string; changelog: string };
}) {
  const pathname = usePathname();
  const tabs = [
    { href: `/${locale}/admin`, label: labels.board, Icon: LayoutGrid, exact: true, badge: 0 },
    {
      href: `/${locale}/admin/submissions`,
      label: labels.submissions,
      Icon: Inbox,
      exact: false,
      badge: pending,
    },
    {
      href: `/${locale}/admin/changelog`,
      label: labels.changelog,
      Icon: Megaphone,
      exact: false,
      badge: 0,
    },
  ];

  return (
    <nav aria-label={labels.board} className="no-scrollbar -mb-px flex items-center gap-1 overflow-x-auto">
      {tabs.map(({ href, label, Icon, exact, badge }) => {
        const isActive = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
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
            {badge > 0 ? (
              <span className="numeral rounded-pill bg-warning-tint px-1.5 py-0.5 text-xs font-bold text-warning-label">
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
