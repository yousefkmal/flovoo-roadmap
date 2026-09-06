import type { BlockDocument, TocEntry } from "@/lib/help/blocks";
import type { Locale } from "@/lib/types";

/**
 * Help center domain types. These mirror `supabase/migrations/0005_help_center.sql`
 * one-to-one, so the seed and a live Supabase row are interchangeable — the
 * same contract the roadmap types keep with `0001_init.sql`.
 */

export const HELP_ARTICLE_STATUSES = ["draft", "published", "archived"] as const;
export type HelpArticleStatus = (typeof HELP_ARTICLE_STATUSES)[number];

export interface HelpCollection {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  /** A Lucide icon name from `HELP_ICONS` — anything else falls back to a book. */
  icon: string;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface HelpArticle {
  id: string;
  collection_id: string;
  status: HelpArticleStatus;
  is_pinned: boolean;
  sort_order: number;
  /**
   * An optional grouping label inside the topic ("Setup", "Troubleshooting").
   * The category page renders one card per section; articles without one
   * share a card. Bilingual like every other label.
   */
  section_ar: string | null;
  section_en: string | null;
  /** A Lucide icon name from `HELP_ICONS`, shown beside the article in navigation. */
  icon: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface HelpArticleTranslation {
  id: string;
  article_id: string;
  language: Locale;
  /** Localized, verbatim in its own script; percent-encoded only in the URL. */
  slug: string;
  title: string;
  excerpt: string | null;
  body: BlockDocument;
  /** Derived from `body` — see `deriveArticleMeta`. Never edited by hand. */
  body_plain: string;
  meta_title: string | null;
  meta_description: string | null;
  og_image_path: string | null;
  /** The direct answer, 40-70 words. Required to publish (Phase 7B). */
  answer_summary: string | null;
  /**
   * True while `answer_summary` is a machine-written draft. A draft counts as
   * no summary at all: readers never see it, and publishing still refuses it.
   */
  summary_needs_review: boolean;
  /** The title as a user would type the question. Optional. */
  question_title: string | null;
  /** 3-6 short facts: limits, prices, prerequisites. */
  key_facts: string[];
  /** When somebody should check the facts again. */
  review_due_at: string | null;
  toc: TocEntry[];
  reading_minutes: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// What the pages render
// ---------------------------------------------------------------------------

/** One article as it appears in a list: the translation the visitor reads. */
export interface HelpArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  readingMinutes: number;
  icon: string;
  isPinned: boolean;
  sortOrder: number;
  /** The section label in the reader's language, or null. */
  section: string | null;
  updatedAt: string;
  collection: HelpCollection;
}

export interface HelpArticleNeighbour {
  slug: string;
  title: string;
}

export interface HelpArticleDetail extends HelpArticleSummary {
  body: BlockDocument;
  toc: TocEntry[];
  publishedAt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  /** An uploaded share image (bucket path), else the generated card is used. */
  ogImagePath: string | null;
  /** The direct answer, rendered as the lead paragraph and used as the description. */
  answerSummary: string | null;
  /** The title phrased as a question, when the writer supplied one. */
  questionTitle: string | null;
  /** Short facts shown "at a glance" and emitted as an ItemList. */
  keyFacts: string[];
  /** The same article in the other language, when it has been translated. */
  alternate: { locale: Locale; slug: string } | null;
  previous: HelpArticleNeighbour | null;
  next: HelpArticleNeighbour | null;
}

/** What the persistent sidebar renders: every topic, with its articles. */
export interface HelpNavArticle {
  id: string;
  slug: string;
  title: string;
  icon: string;
}

export interface HelpNavCollection {
  id: string;
  slug: string;
  name: string;
  icon: string;
  articles: HelpNavArticle[];
}

export interface HelpNavActive {
  collectionId: string | null;
  articleId: string | null;
}

export interface HelpCollectionWithCount extends HelpCollection {
  /** Published articles that have a translation in the visitor's language. */
  articleCount: number;
}

/** What search indexes: one published translation with enough context to rank and snippet. */
export interface HelpSearchDocument {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  bodyPlain: string;
  collection: { id: string; slug: string; name: string };
}

/** A file in the media library. `storage_path` is bucket-relative. */
export interface HelpMedia {
  id: string;
  storage_path: string;
  alt_ar: string | null;
  alt_en: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

/** One row of the admin articles list: language-neutral fields plus both translations. */
export interface HelpAdminArticleRow {
  id: string;
  status: HelpArticleStatus;
  isPinned: boolean;
  sortOrder: number;
  icon: string;
  section: { ar: string; en: string } | null;
  collection: { id: string; slug: string; name_ar: string; name_en: string };
  ar: { slug: string; title: string } | null;
  en: { slug: string; title: string } | null;
  updatedAt: string;
  publishedAt: string | null;
  /** Any figure in either language still carrying a machine-written alt. */
  hasDraftAlt: boolean;
  /** A translation exists with no answer summary — it cannot be published. */
  needsSummary: boolean;
  /** True when a drafted summary is present but nobody has approved it. */
  summaryUnreviewed: boolean;
  /** The earliest review date across its translations. */
  reviewDueAt: string | null;
  /** Whether that date has passed. Computed server-side, never during render. */
  reviewDue: boolean;
}

/** Everything the editor needs for one article. */
export interface HelpAdminArticle {
  article: HelpArticle;
  translations: Partial<Record<Locale, HelpArticleTranslation>>;
}

/** One redirect from an old address to a current one. Paths are public shapes. */
export interface HelpRedirect {
  id: string;
  source_path: string;
  target_path: string;
  status_code: number;
  hits: number;
  created_at: string;
  updated_at: string;
}
