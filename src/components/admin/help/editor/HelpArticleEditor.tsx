"use client";

import { GeoPanel } from "./GeoPanel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ExternalLink, Monitor, Smartphone, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  saveHelpArticleAction,
  type HelpArticlePayload,
  type HelpFieldError,
} from "@/app/[locale]/admin/help/actions";
import { IconPicker, errorLabel } from "@/components/admin/help/HelpCollectionsManager";
import { ArticleBody } from "@/components/help/ArticleBody";
import { FIELD_CLASS, Field } from "@/components/ui/Field";
import { getDictionary, type Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { BlockDocument } from "@/lib/help/blocks";
import { suggestSlug } from "@/lib/help/slug";
import {
  EMPTY_TRANSLATION,
  type ArticleDraft,
  type EditorCollectionOption,
  type TranslationDraft,
} from "@/lib/help/editor-draft";

export {
  EMPTY_TRANSLATION,
  type ArticleDraft,
  type EditorCollectionOption,
  type TranslationDraft,
};
import { HELP_ARTICLE_STATUSES, type HelpArticleStatus } from "@/lib/help/types";

import { BlockEditor } from "./BlockEditor";
import type { PickedImage } from "./extensions";
import { MediaPicker, type PickerMediaItem } from "./MediaPicker";

/**
 * A2 — the article editor. Arabic and English each have their own tab with
 * slug, title, excerpt, meta and a block editor; settings apply to the
 * article as a whole; the preview renders the public `ArticleBody` from the
 * live JSON, at desktop or phone width, in the tab's language and direction.
 *
 * Arabic is required (it is the product default); English may be left empty
 * and the article then shows the missing-translation notice on the public site.
 */
export function HelpArticleEditor({
  initial,
  collections,
  media,
  locale,
  dict,
  publicHref,
}: {
  initial: ArticleDraft;
  collections: EditorCollectionOption[];
  media: PickerMediaItem[];
  locale: Locale;
  dict: Dictionary;
  publicHref: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ArticleDraft>(initial);
  const [tab, setTab] = useState<Locale>("ar");
  const [showPreview, setShowPreview] = useState(true);
  const [previewWidth, setPreviewWidth] = useState<"desktop" | "mobile">("desktop");
  const [errors, setErrors] = useState<Record<string, HelpFieldError>>({});
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [library, setLibrary] = useState(media);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerResolve = useRef<((image: PickedImage | null) => void) | null>(null);

  const t = dict.adminHelp;

  const pickImage = useCallback(() => {
    setPickerOpen(true);
    return new Promise<PickedImage | null>((resolve) => {
      pickerResolve.current = resolve;
    });
  }, []);

  function closePicker(image: PickedImage | null) {
    setPickerOpen(false);
    pickerResolve.current?.(image);
    pickerResolve.current = null;
  }

  function patch(next: Partial<ArticleDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function patchTranslation(language: Locale, next: Partial<TranslationDraft>) {
    setDraft((current) => ({ ...current, [language]: { ...current[language], ...next } }));
  }

  const onArBody = useCallback((body: BlockDocument) => patchTranslation("ar", { body }), []);
  const onEnBody = useCallback((body: BlockDocument) => patchTranslation("en", { body }), []);

  function save(statusOverride?: HelpArticleStatus) {
    const status = statusOverride ?? draft.status;
    // ProseMirror builds node attrs with `Object.create(null)`; React refuses to
    // serialise prototype-less objects into a Server Action. A JSON round trip
    // yields the plain document the action expects.
    const plain = (t: TranslationDraft) => ({
      ...t,
      // The action asks "is this summary approved?", which is the opposite of
      // the flag the editor holds.
      summary_reviewed: !t.summary_needs_review,
      body: JSON.parse(JSON.stringify(t.body)) as BlockDocument,
    });
    const payload: HelpArticlePayload = {
      collection_id: draft.collectionId,
      status,
      is_pinned: draft.isPinned,
      sort_order: draft.sortOrder,
      section_ar: draft.sectionAr,
      section_en: draft.sectionEn,
      icon: draft.icon,
      translations: { ar: plain(draft.ar), en: plain(draft.en) },
    };
    setNotice(null);
    startTransition(async () => {
      const result = await saveHelpArticleAction(locale, draft.id, payload);
      if (result.status === "ok") {
        setErrors({});
        setDraft((current) => ({ ...current, id: result.id, status }));
        setNotice({ kind: "ok", text: t.saved });
        if (!draft.id) router.replace(`/${locale}/admin/help/articles/${result.id}`);
        router.refresh();
      } else if (result.status === "invalid") {
        setErrors(result.errors);
        setNotice({ kind: "error", text: t.fixErrors });
        // Jump to the tab that holds the first problem.
        const firstKey = Object.keys(result.errors)[0];
        if (firstKey?.startsWith("en.")) setTab("en");
        else if (firstKey?.startsWith("ar.")) setTab("ar");
      } else {
        setNotice({ kind: "error", text: t.saveFailed });
      }
    });
  }

  const err = (key: string) => (errors[key] ? errorLabel(dict, errors[key]) : undefined);
  const statusLabel: Record<HelpArticleStatus, string> = {
    draft: t.statusDraft,
    published: t.statusPublished,
    archived: t.statusArchived,
  };
  // The body toolbar is sticky too, and has to park directly under this bar.
  // Its height is not a constant: the bar wraps to two rows on a narrow screen,
  // so it is measured and published as a custom property the toolbar reads.
  const rootRef = useRef<HTMLDivElement>(null);
  const saveBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = saveBarRef.current;
    const root = rootRef.current;
    if (!bar || !root) return;
    const publish = () => {
      const top = Number.parseFloat(getComputedStyle(bar).top) || 0;
      root.style.setProperty("--help-sticky-top", `${Math.round(top + bar.offsetHeight)}px`);
    };
    publish();
    // Two triggers, because the bar changes height for two reasons: the
    // viewport narrowing until it wraps, and its own contents changing.
    window.addEventListener("resize", publish);
    const observer = new ResizeObserver(publish);
    observer.observe(bar);
    return () => {
      window.removeEventListener("resize", publish);
      observer.disconnect();
    };
  });

  const enEmpty = !draft.en.title && !draft.en.slug;
  const previewDict = getDictionary(tab);
  const previewDraft = draft[tab];

  return (
    <div ref={rootRef} className="mt-6 flex flex-col gap-6">
      {/* Save bar */}
      <div
        ref={saveBarRef}
        className="sticky top-16 z-20 -mx-5 flex flex-wrap items-center gap-2 border-b border-border bg-card/95 px-5 py-2.5 backdrop-blur lg:-mx-10 lg:px-10"
      >
        <div className="flex items-center gap-1 rounded-control border border-border p-0.5" role="tablist" aria-label={t.tabAr}>
          {(["ar", "en"] as const).map((language) => (
            <button
              key={language}
              type="button"
              role="tab"
              aria-selected={tab === language}
              onClick={() => setTab(language)}
              className={`inline-flex h-8 items-center rounded-[8px] px-3 text-sm font-semibold transition-colors duration-(--dur-micro) ${
                tab === language ? "bg-info-tint text-link" : "text-text-secondary hover:text-text"
              } ${Object.keys(errors).some((k) => k.startsWith(`${language}.`)) ? "underline decoration-danger decoration-2" : ""}`}
            >
              {language === "ar" ? t.tabAr : enEmpty ? t.tabEnEmpty : t.tabEn}
            </button>
          ))}
        </div>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          {notice ? (
            <p role="status" className={`text-sm font-medium ${notice.kind === "ok" ? "text-success-label" : "text-danger"}`}>
              {notice.text}
            </p>
          ) : null}
          {publicHref && draft.status === "published" ? (
            <a href={publicHref} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border px-3 text-sm font-semibold text-text-secondary hover:text-text">
              <ExternalLink className="size-4" strokeWidth={2} aria-hidden />
              {t.viewPublic}
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            aria-pressed={showPreview}
            className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border px-3 text-sm font-semibold text-text-secondary hover:text-text lg:inline-flex"
          >
            {showPreview ? <EyeOff className="size-4" strokeWidth={2} aria-hidden /> : <Eye className="size-4" strokeWidth={2} aria-hidden />}
            {showPreview ? t.previewHide : t.preview}
          </button>
          <button type="button" disabled={pending} onClick={() => save()} className="inline-flex h-9 items-center rounded-control border border-border px-4 text-sm font-semibold text-text hover:border-flovoo-blue/40 disabled:opacity-60">
            {pending ? t.saving : t.save}
          </button>
          {draft.status !== "published" ? (
            <button type="button" disabled={pending} onClick={() => save("published")} className="gradient-brand inline-flex h-9 items-center rounded-control px-4 text-sm font-semibold text-white transition-opacity duration-(--dur-micro) hover:opacity-90 disabled:opacity-60">
              {t.publishNow}
            </button>
          ) : (
            <button type="button" disabled={pending} onClick={() => save("draft")} className="inline-flex h-9 items-center rounded-control border border-border px-4 text-sm font-semibold text-text-secondary hover:text-text disabled:opacity-60">
              {t.unpublish}
            </button>
          )}
        </div>
      </div>

      <div className={`grid gap-6 ${showPreview ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
        {/* Editor column */}
        <div className="flex min-w-0 flex-col gap-6">
          {(["ar", "en"] as const).map((language) => (
            <div key={language} hidden={tab !== language} className="flex flex-col gap-4">
              <TranslationFields
                language={language}
                draft={draft[language]}
                onChange={(next) => patchTranslation(language, next)}
                err={(field) => err(`${language}.${field}`)}
                t={t}
                dictionary={dict}
              />
              <div>
                <p className="mb-1.5 text-sm font-semibold text-text">{t.fieldBody}</p>
                <BlockEditor
                  initial={initial[language].body}
                  locale={language}
                  labels={t}
                  onChange={language === "ar" ? onArBody : onEnBody}
                  pickImage={pickImage}
                  invalid={Boolean(errors[`${language}.body`])}
                />
                {err(`${language}.body`) ? (
                  <p role="alert" className="mt-1 text-xs font-medium text-danger">{err(`${language}.body`)}</p>
                ) : null}
              </div>
            </div>
          ))}

          <section aria-labelledby="help-editor-settings" className="rounded-card border border-border bg-card p-5">
            <h2 id="help-editor-settings" className="text-sm font-bold text-text">{t.settingsTitle}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field id="collection" label={t.fieldCollection} error={err("collection_id")}>
                <select id="collection" value={draft.collectionId} onChange={(e) => patch({ collectionId: e.target.value })} className={FIELD_CLASS}>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field id="status" label={t.fieldStatus}>
                <select id="status" value={draft.status} onChange={(e) => patch({ status: e.target.value as HelpArticleStatus })} className={FIELD_CLASS}>
                  {HELP_ARTICLE_STATUSES.map((s) => (
                    <option key={s} value={s}>{statusLabel[s]}</option>
                  ))}
                </select>
              </Field>
              <Field id="sort-order" label={t.fieldSortOrder}>
                <input id="sort-order" type="number" min={0} value={draft.sortOrder} onChange={(e) => patch({ sortOrder: Number(e.target.value) || 0 })} className={`${FIELD_CLASS} numeral`} />
              </Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-text">
                <input type="checkbox" checked={draft.isPinned} onChange={(e) => patch({ isPinned: e.target.checked })} className="size-4 accent-flovoo-blue" />
                {t.fieldPinned}
              </label>
              <Field id="section-ar" label={t.fieldSectionAr} error={err("section_ar")}>
                <input id="section-ar" dir="rtl" lang="ar" value={draft.sectionAr} onChange={(e) => patch({ sectionAr: e.target.value })} className={`${FIELD_CLASS} text-start`} />
              </Field>
              <Field id="section-en" label={t.fieldSectionEn} hint={undefined} error={err("section_en")}>
                <input id="section-en" dir="ltr" lang="en" value={draft.sectionEn} onChange={(e) => patch({ sectionEn: e.target.value })} className={`${FIELD_CLASS} text-start`} />
              </Field>
            </div>
            <p className="mt-2 text-xs text-text-tertiary">{t.sectionHint}</p>
            <div className="mt-4">
              <p className="mb-1.5 text-sm font-semibold text-text">{t.fieldIcon}</p>
              <IconPicker id="article-icon" name="icon" defaultValue={draft.icon} onChange={(icon) => patch({ icon })} />
              {err("icon") ? <p role="alert" className="mt-1 text-xs font-medium text-danger">{err("icon")}</p> : null}
            </div>
          </section>
        </div>

        {/* Preview column */}
        {showPreview ? (
          <aside className="min-w-0">
            <div className="sticky top-32">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-text">{t.preview}</p>
                <div className="flex items-center gap-1 rounded-control border border-border p-0.5">
                  <button type="button" aria-pressed={previewWidth === "desktop"} aria-label={t.previewDesktop} onClick={() => setPreviewWidth("desktop")} className={`inline-flex size-7 items-center justify-center rounded-[6px] ${previewWidth === "desktop" ? "bg-info-tint text-link" : "text-text-secondary"}`}>
                    <Monitor className="size-4" strokeWidth={2} aria-hidden />
                  </button>
                  <button type="button" aria-pressed={previewWidth === "mobile"} aria-label={t.previewMobile} onClick={() => setPreviewWidth("mobile")} className={`inline-flex size-7 items-center justify-center rounded-[6px] ${previewWidth === "mobile" ? "bg-info-tint text-link" : "text-text-secondary"}`}>
                    <Smartphone className="size-4" strokeWidth={2} aria-hidden />
                  </button>
                </div>
              </div>
              <div className="rounded-card border border-border bg-column p-4">
                <div
                  dir={tab === "ar" ? "rtl" : "ltr"}
                  lang={tab}
                  className={`help-surface mx-auto max-h-[70vh] overflow-y-auto rounded-control border border-border bg-page px-5 py-6 ${
                    previewWidth === "mobile" ? "w-[375px] max-w-full" : "w-full"
                  }`}
                >
                  {previewDraft.title || previewDraft.body.content.length > 0 ? (
                    <article>
                      <h1 className="text-2xl font-bold leading-tight text-text">{previewDraft.title}</h1>
                      {previewDraft.excerpt ? <p className="mt-2 text-base leading-6 text-text-secondary">{previewDraft.excerpt}</p> : null}
                      <div className="mt-6">
                        <ArticleBody body={previewDraft.body} dict={previewDict} />
                      </div>
                    </article>
                  ) : (
                    <p className="text-sm text-text-tertiary">{t.previewEmpty}</p>
                  )}
                </div>
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      <p className="text-xs text-text-tertiary">
        <Link href={`/${locale}/admin/help`} className="font-semibold text-link hover:underline">{t.navArticles}</Link>
      </p>

      <MediaPicker
        open={pickerOpen}
        items={library}
        locale={tab}
        dict={dict}
        onPick={(image) => closePicker(image)}
        onClose={() => closePicker(null)}
        onUploaded={(item) => setLibrary((current) => [item, ...current])}
      />
    </div>
  );
}

function TranslationFields({
  language,
  draft,
  onChange,
  err,
  t,
  dictionary,
}: {
  language: Locale;
  draft: TranslationDraft;
  onChange: (next: Partial<TranslationDraft>) => void;
  err: (field: string) => string | undefined;
  t: Dictionary["adminHelp"];
  dictionary: Dictionary;
}) {
  const dir = language === "ar" ? "rtl" : "ltr";
  const id = (field: string) => `${language}-${field}`;
  return (
    <div className="grid gap-4 rounded-card border border-border bg-card p-5 sm:grid-cols-2">
      <Field id={id("title")} label={t.fieldTitle} error={err("title")}>
        <input id={id("title")} dir={dir} lang={language} value={draft.title} onChange={(e) => onChange({ title: e.target.value })} aria-invalid={Boolean(err("title"))} className={`${FIELD_CLASS} text-start`} />
      </Field>
      <Field id={id("slug")} label={t.fieldSlug} error={err("slug")}>
        <div className="flex gap-2">
          <input id={id("slug")} dir={dir} lang={language} value={draft.slug} onChange={(e) => onChange({ slug: e.target.value })} aria-invalid={Boolean(err("slug"))} className={`${FIELD_CLASS} numeric text-start`} />
          <button type="button" onClick={() => onChange({ slug: suggestSlug(draft.title) })} className="shrink-0 rounded-control border border-border px-3 text-xs font-semibold text-text-secondary hover:text-text">
            {t.suggestSlug}
          </button>
        </div>
        <p className="mt-1 text-xs text-text-tertiary">{t.slugHint}</p>
      </Field>
      {/* The paragraph a retrieval system reads first, so it sits directly
          under the title rather than among the SEO fields at the bottom. */}
      <div className="sm:col-span-2">
        <Field id={id("answer-summary")} label={t.fieldAnswerSummary} hint={t.answerSummaryHint} error={err("answer_summary")}>
          {draft.summary_needs_review ? (
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-tint px-2 py-0.5 text-[11px] font-bold text-warning-label">
                <TriangleAlert className="size-3" strokeWidth={2.5} aria-hidden />
                {t.summaryUnreviewed}
              </span>
              <button
                type="button"
                onClick={() => onChange({ summary_needs_review: false })}
                className="text-xs font-semibold text-link hover:underline"
              >
                {t.summaryApprove}
              </button>
            </div>
          ) : null}
          <textarea
            id={id("answer-summary")}
            dir={dir}
            lang={language}
            rows={3}
            value={draft.answer_summary}
            /* Editing is the review — the same rule a drafted alt text follows. */
            onChange={(e) => onChange({ answer_summary: e.target.value, summary_needs_review: false })}
            aria-invalid={Boolean(err("answer_summary"))}
            className={`${FIELD_CLASS} text-start ${draft.summary_needs_review ? "border-warning-label" : ""}`}
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id={id("question-title")} label={t.fieldQuestionTitle} hint={t.questionTitleHint} error={err("question_title")}>
          <input id={id("question-title")} dir={dir} lang={language} value={draft.question_title} onChange={(e) => onChange({ question_title: e.target.value })} className={`${FIELD_CLASS} text-start`} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id={id("key-facts")} label={t.fieldKeyFacts} hint={t.keyFactsHint}>
          {/* One per line is the shape writers already use; splitting here
              keeps the stored value a clean array. */}
          <textarea
            id={id("key-facts")}
            dir={dir}
            lang={language}
            rows={3}
            value={draft.key_facts.join("\n")}
            onChange={(e) =>
              onChange({
                key_facts: e.target.value.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 6),
              })
            }
            className={`${FIELD_CLASS} text-start`}
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id={id("excerpt")} label={t.fieldExcerpt} hint={t.excerptHint} error={err("excerpt")}>
          <textarea id={id("excerpt")} dir={dir} lang={language} rows={2} value={draft.excerpt} onChange={(e) => onChange({ excerpt: e.target.value })} className={`${FIELD_CLASS} text-start`} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <GeoPanel draft={draft} locale={language} dict={dictionary} />
      </div>
      <Field id={id("meta-title")} label={t.fieldMetaTitle} error={err("meta_title")}>
        <input id={id("meta-title")} dir={dir} lang={language} value={draft.meta_title} onChange={(e) => onChange({ meta_title: e.target.value })} className={`${FIELD_CLASS} text-start`} />
      </Field>
      <Field id={id("meta-description")} label={t.fieldMetaDescription} error={err("meta_description")}>
        <input id={id("meta-description")} dir={dir} lang={language} value={draft.meta_description} onChange={(e) => onChange({ meta_description: e.target.value })} className={`${FIELD_CLASS} text-start`} />
        <p className="mt-1 text-xs text-text-tertiary">{t.metaHint}</p>
      </Field>
    </div>
  );
}
