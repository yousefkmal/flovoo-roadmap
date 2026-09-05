import { EMPTY_DOCUMENT, type BlockDocument } from "@/lib/help/blocks";
import type { HelpArticleStatus } from "@/lib/help/types";

/**
 * The shapes the article editor edits, and the empty one it starts from.
 *
 * These live outside the editor component because the editor page — a server
 * component — builds the initial draft. A value exported from a `"use client"`
 * module reaches the server as a reference proxy, not the object, so reading
 * `.body` off it there fails at render time.
 */

export interface TranslationDraft {
  slug: string;
  title: string;
  excerpt: string;
  body: BlockDocument;
  meta_title: string;
  meta_description: string;
}

export interface ArticleDraft {
  id: string | null;
  collectionId: string;
  status: HelpArticleStatus;
  isPinned: boolean;
  sortOrder: number;
  sectionAr: string;
  sectionEn: string;
  icon: string;
  ar: TranslationDraft;
  en: TranslationDraft;
}

export interface EditorCollectionOption {
  id: string;
  name: string;
}

export const EMPTY_TRANSLATION: TranslationDraft = {
  slug: "",
  title: "",
  excerpt: "",
  body: EMPTY_DOCUMENT,
  meta_title: "",
  meta_description: "",
};
