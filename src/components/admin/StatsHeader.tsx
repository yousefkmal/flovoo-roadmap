import Link from "next/link";
import { Inbox, Lightbulb, ThumbsUp, TrendingUp } from "lucide-react";

import type { AdminStats } from "@/lib/data/admin-repository";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

/**
 * The numbers an admin opens the board to check.
 *
 * Four counts and the top five, nothing else: a dashboard that shows everything
 * is one nobody reads. The pending count links to the queue, because seeing a
 * backlog and then hunting for it is the wrong order.
 */
export function StatsHeader({
  stats,
  locale,
  dict,
}: {
  stats: AdminStats;
  locale: Locale;
  dict: Dictionary;
}) {
  const tiles = [
    { label: dict.admin.statsTotalVotes, value: stats.totalVotes, Icon: ThumbsUp },
    { label: dict.admin.statsLiveFeatures, value: stats.liveFeatures, Icon: TrendingUp },
    {
      label: dict.admin.statsPending,
      value: stats.pendingSubmissions,
      Icon: Inbox,
      href: `/${locale}/admin/submissions`,
    },
    { label: dict.admin.statsThisMonth, value: stats.submissionsThisMonth, Icon: Lightbulb },
  ];

  return (
    <section aria-label={dict.admin.title} className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(({ label, value, Icon, href }) => {
          const body = (
            <>
              <span className="inline-flex size-8 items-center justify-center rounded-control bg-subtle text-text-tertiary">
                <Icon className="size-4" strokeWidth={2} aria-hidden />
              </span>
              <span className="numeral mt-3 block text-2xl font-bold text-text">
                {value}
              </span>
              <span className="mt-0.5 block text-xs text-text-secondary">{label}</span>
            </>
          );

          return href ? (
            <Link
              key={label}
              href={href}
              className="rounded-control border border-border bg-card p-4 transition-colors duration-(--dur-micro) hover:border-flovoo-blue/50"
            >
              {body}
            </Link>
          ) : (
            <div
              key={label}
              className="rounded-control border border-border bg-card p-4"
            >
              {body}
            </div>
          );
        })}
      </div>

      <div className="rounded-control border border-border bg-card p-4">
        <h2 className="label-caps mb-3 text-text-secondary">
          {dict.admin.statsTopVoted}
        </h2>
        <ol className="flex flex-col gap-2">
          {stats.topVoted.map((feature, index) => (
            <li key={feature.id} className="flex items-center gap-2 text-sm">
              <span className="numeral w-4 shrink-0 text-xs font-semibold text-text-tertiary">
                {index + 1}
              </span>
              <Link
                href={`/${locale}/admin/features/${feature.id}`}
                className="min-w-0 flex-1 truncate text-text-secondary transition-colors duration-(--dur-micro) hover:text-link"
              >
                {locale === "ar" ? feature.titleAr : feature.titleEn}
              </Link>
              <span className="numeral shrink-0 text-xs font-semibold text-text">
                {feature.votes}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
