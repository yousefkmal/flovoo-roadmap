"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileText, FolderTree, Images, Route } from "lucide-react";

import type { Locale } from "@/i18n/config";

/** The help center's three admin surfaces, as a second row under the admin tabs. */
export function HelpAdminNav({
  locale,
  labels,
}: {
  locale: Locale;
  labels: { articles: string; collections: string; media: string; redirects: string; analytics: string };
}) {
  const pathname = usePathname();
  const base = `/${locale}/admin/help`;
  const items = [
    { href: base, label: labels.articles, Icon: FileText, exact: false, excludes: [`${base}/collections`, `${base}/media`, `${base}/redirects`, `${base}/analytics`] },
    { href: `${base}/collections`, label: labels.collections, Icon: FolderTree, exact: false, excludes: [] },
    { href: `${base}/media`, label: labels.media, Icon: Images, exact: false, excludes: [] },
    { href: `${base}/redirects`, label: labels.redirects, Icon: Route, exact: false, excludes: [] },
    { href: `${base}/analytics`, label: labels.analytics, Icon: BarChart3, exact: false, excludes: [] },
  ];

  return (
    <nav aria-label={labels.articles} className="flex flex-wrap items-center gap-1.5">
      {items.map(({ href, label, Icon, excludes }) => {
        const isActive =
          pathname.startsWith(href) && !excludes.some((ex) => pathname.startsWith(ex));
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-sm font-semibold transition-colors duration-(--dur-micro) ${
              isActive
                ? "bg-info-tint text-link"
                : "text-text-secondary hover:bg-subtle hover:text-text"
            }`}
          >
            <Icon className="size-4" strokeWidth={2} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
