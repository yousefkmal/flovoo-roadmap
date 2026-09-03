import { formatDate, isNew } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import type { FeatureStatus, FeatureWithCategory } from "@/lib/types";

/**
 * The shape the board actually renders. Built once on the server so the client
 * component never touches Intl, the raw bilingual columns, or the clock.
 */
export interface FeatureView {
  id: string;
  title: string;
  description: string | null;
  status: FeatureStatus;
  votes: number;
  isPinned: boolean;
  isNew: boolean;
  /** Whether this visitor has voted for it — per-request, not cacheable. */
  hasVoted: boolean;
  /** Whether this visitor asked to be told when it ships. */
  isFollowing: boolean;
  submittedBy: string | null;
  createdLabel: string;
  shippedLabel: string | null;
  createdAtMs: number;
  shippedAtMs: number | null;
  category: { slug: string; name: string; color: string } | null;
  /** Lower-cased title + description, so filtering is a single substring test. */
  haystack: string;
}

export function toFeatureView(
  feature: FeatureWithCategory,
  locale: Locale,
  now: number = Date.now(),
  votedIds: ReadonlySet<string> = new Set(),
  followedIds: ReadonlySet<string> = new Set(),
): FeatureView {
  const title = locale === "ar" ? feature.title_ar : feature.title_en;
  const description =
    locale === "ar" ? feature.description_ar : feature.description_en;

  return {
    id: feature.id,
    title,
    description,
    status: feature.status,
    votes: feature.vote_count,
    isPinned: feature.is_pinned,
    isNew: isNew(feature.created_at, now),
    hasVoted: votedIds.has(feature.id),
    isFollowing: followedIds.has(feature.id),
    submittedBy: feature.submitted_by_name,
    createdLabel: formatDate(feature.created_at, locale),
    shippedLabel: feature.shipped_at ? formatDate(feature.shipped_at, locale) : null,
    createdAtMs: Date.parse(feature.created_at),
    shippedAtMs: feature.shipped_at ? Date.parse(feature.shipped_at) : null,
    category: feature.category
      ? {
          slug: feature.category.slug,
          name:
            locale === "ar" ? feature.category.name_ar : feature.category.name_en,
          color: feature.category.color,
        }
      : null,
    // Search should match either language, so both titles go into the haystack.
    haystack: [
      feature.title_ar,
      feature.title_en,
      feature.description_ar,
      feature.description_en,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}
