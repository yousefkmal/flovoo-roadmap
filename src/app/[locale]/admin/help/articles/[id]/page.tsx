import { notFound } from "next/navigation";

import { HelpArticleEditor } from "@/components/admin/help/editor/HelpArticleEditor";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import {
  getAdminHelpArticle,
  getAdminHelpCollections,
  getAdminHelpMedia,
} from "@/lib/data/help-admin-repository";
import { mediaPublicUrl } from "@/lib/help/media";
import { helpArticleHref } from "@/lib/help/paths";
import {
  EMPTY_TRANSLATION,
  type ArticleDraft,
  type TranslationDraft,
} from "@/lib/help/editor-draft";
import { suggestSlug } from "@/lib/help/slug";
import type { HelpArticleTranslation } from "@/lib/help/types";
import { requireAdminPage } from "@/lib/auth/admin";

/** A2 — the editor page. `new` creates; an id edits. */
export const dynamic = "force-dynamic";

function toDraft(translation: HelpArticleTranslation | undefined): TranslationDraft {
  if (!translation) return EMPTY_TRANSLATION;
  return {
    slug: translation.slug,
    title: translation.title,
    excerpt: translation.excerpt ?? "",
    body: translation.body,
    meta_title: translation.meta_title ?? "",
    meta_description: translation.meta_description ?? "",
    answer_summary: translation.answer_summary ?? "",
    summary_needs_review: translation.summary_needs_review === true,
    question_title: translation.question_title ?? "",
    key_facts: Array.isArray(translation.key_facts) ? translation.key_facts : [],
  };
}

export default async function HelpArticleEditorPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/help/articles/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPage();
  const dict = getDictionary(locale);

  const [collections, media] = await Promise.all([getAdminHelpCollections(), getAdminHelpMedia()]);
  if (collections.length === 0) notFound();

  let initial: ArticleDraft;
  let publicHref: string | null = null;

  if (id === "new") {
    // "Create draft from this" in the content-gap inbox arrives with the
    // question already written; the question is usually the better headline.
    const prefill = await searchParams;
    const rawTitle = Array.isArray(prefill.title) ? prefill.title[0] : prefill.title;
    const rawLang = Array.isArray(prefill.lang) ? prefill.lang[0] : prefill.lang;
    const title = (rawTitle ?? "").trim().slice(0, 200);
    const language: "ar" | "en" = rawLang === "en" ? "en" : "ar";
    const seeded = title
      ? { ...EMPTY_TRANSLATION, title, slug: suggestSlug(title) }
      : EMPTY_TRANSLATION;

    initial = {
      id: null,
      collectionId: collections[0].id,
      status: "draft",
      isPinned: false,
      sortOrder: 0,
      sectionAr: "",
      sectionEn: "",
      icon: "file-text",
      ar: language === "ar" ? seeded : EMPTY_TRANSLATION,
      en: language === "en" ? seeded : EMPTY_TRANSLATION,
    };
  } else {
    const found = await getAdminHelpArticle(id);
    if (!found) notFound();
    initial = {
      id: found.article.id,
      collectionId: found.article.collection_id,
      status: found.article.status,
      isPinned: found.article.is_pinned,
      sortOrder: found.article.sort_order,
      sectionAr: found.article.section_ar ?? "",
      sectionEn: found.article.section_en ?? "",
      icon: found.article.icon,
      ar: toDraft(found.translations.ar),
      en: toDraft(found.translations.en),
    };
    const own = found.translations[locale] ?? found.translations.ar;
    publicHref = own ? helpArticleHref(locale, own.slug) : null;
  }

  return (
    <main className="mx-auto w-full max-w-board px-5 py-8 lg:px-10">
      <h1 className="text-2xl/8 font-bold text-text">
        {initial.id ? dict.adminHelp.editorTitleEdit : dict.adminHelp.editorTitleNew}
      </h1>
      <HelpArticleEditor
        initial={initial}
        collections={collections.map((c) => ({
          id: c.id,
          name: locale === "ar" ? c.name_ar : c.name_en,
        }))}
        media={media.map((m) => ({
          id: m.id,
          url: mediaPublicUrl(m.storage_path),
          altAr: m.alt_ar ?? "",
          altEn: m.alt_en ?? "",
          width: m.width,
          height: m.height,
        }))}
        locale={locale}
        dict={dict}
        publicHref={publicHref}
      />
    </main>
  );
}
