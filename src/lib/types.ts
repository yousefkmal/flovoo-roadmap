/**
 * Domain types. These mirror the Postgres schema in
 * `supabase/migrations/0001_init.sql` one-to-one, so the seed data and a live
 * Supabase response are interchangeable.
 */

export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const FEATURE_STATUSES = [
  "under_review",
  "planned",
  "in_progress",
  "shipped",
  "archived",
] as const;
export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

/** The four stages that render as columns on the public board. */
export const BOARD_STATUSES = [
  "under_review",
  "planned",
  "in_progress",
  "shipped",
] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export type FeatureSource = "internal" | "customer_submission";

export interface Category {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  color: string;
  sort_order: number;
}

export interface Feature {
  id: string;
  title_ar: string;
  title_en: string;
  description_ar: string | null;
  description_en: string | null;
  status: FeatureStatus;
  category_id: string | null;
  vote_count: number;
  is_pinned: boolean;
  source: FeatureSource;
  submitted_by_name: string | null;
  shipped_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A feature joined with its category, which is what the UI actually renders. */
export interface FeatureWithCategory extends Feature {
  category: Category | null;
}

export const CHANGELOG_KINDS = ["new", "improved", "fixed"] as const;
export type ChangelogKind = (typeof CHANGELOG_KINDS)[number];

/** The emoji the UI offers. Mirrors the check constraint on the table. */
export const REACTION_EMOJI = ["🎉", "🔥", "💯", "👏", "❤️"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJI)[number];

export interface ChangelogEntry {
  id: string;
  feature_id: string | null;
  kind: ChangelogKind;
  title_ar: string;
  title_en: string;
  body_ar: string | null;
  body_en: string | null;
  image_url: string | null;
  image_alt_ar: string | null;
  image_alt_en: string | null;
  /** "Read more" — the full write-up, wherever it lives. */
  article_url: string | null;
  /** "Explore it" — the feature itself, in the product. */
  action_url: string | null;
  action_label_ar: string | null;
  action_label_en: string | null;
  is_published: boolean;
  published_at: string | null;
}

/** Picks the field matching the active locale off any bilingual record. */
export function localized<T extends Record<string, unknown>, K extends string>(
  record: T,
  field: K,
  locale: Locale,
): T[`${K}_ar` & keyof T] {
  return record[`${field}_${locale}` as keyof T] as T[`${K}_ar` & keyof T];
}
