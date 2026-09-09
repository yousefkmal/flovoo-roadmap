"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronUp, ImagePlus, Save, TriangleAlert } from "lucide-react";

import { CategoryChip } from "@/components/ui/CategoryChip";
import { FIELD_CLASS, Field } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { saveFeatureAction, type EditorState } from "@/app/[locale]/admin/actions";
import { MediaPicker, type PickerMediaItem } from "@/components/admin/help/editor/MediaPicker";
import { t, type Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { FEATURE_STATUSES, type FeatureStatus } from "@/lib/types";

export interface EditorCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  color: string;
}

export interface EditorFeature {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  status: FeatureStatus;
  categoryId: string | null;
  isPinned: boolean;
  votes: number;
  imageUrl: string;
  imageAltAr: string;
  imageAltEn: string;
}

/**
 * The item editor.
 *
 * Arabic and English sit side by side rather than behind a language toggle: the
 * board renders both, so writing one without the other is the mistake the form
 * should make hard. The preview below shows the card exactly as each audience
 * will see it, in its own direction, and updates as you type — which is the only
 * way to catch a title that wraps badly in one language and not the other.
 */
export function FeatureEditor({
  feature,
  categories,
  locale,
  dict,
  media,
}: {
  feature: EditorFeature | null;
  categories: EditorCategory[];
  locale: Locale;
  dict: Dictionary;
  media: PickerMediaItem[];
}) {
  const [state, formAction, pending] = useActionState<EditorState, FormData>(
    saveFeatureAction.bind(null, locale, feature?.id ?? null),
    { status: "idle" },
  );

  const [draft, setDraft] = useState({
    titleAr: feature?.titleAr ?? "",
    titleEn: feature?.titleEn ?? "",
    status: feature?.status ?? ("under_review" as FeatureStatus),
    categoryId: feature?.categoryId ?? "",
    isPinned: feature?.isPinned ?? false,
  });

  // The picture, held in state so choosing from the library fills the fields
  // and the preview at once.
  const [image, setImage] = useState({
    url: feature?.imageUrl ?? "",
    altAr: feature?.imageAltAr ?? "",
    altEn: feature?.imageAltEn ?? "",
  });
  const [library, setLibrary] = useState(media);
  const [pickerOpen, setPickerOpen] = useState(false);

  const errors = state.status === "invalid" ? state.errors : {};
  const category = categories.find((c) => c.id === draft.categoryId) ?? null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form action={formAction} className="flex min-w-0 flex-col gap-6">
        <p className="text-sm text-text-tertiary">{dict.admin.editorHint}</p>

        <div className="grid gap-5 md:grid-cols-2">
          <Field
            id="title_ar"
            label={dict.admin.fieldTitleAr}
            error={errors.title_ar ? dict.fieldError[errors.title_ar] : undefined}
          >
            <input
              id="title_ar"
              name="title_ar"
              dir="rtl"
              lang="ar"
              required
              defaultValue={feature?.titleAr}
              onChange={(e) => setDraft((d) => ({ ...d, titleAr: e.target.value }))}
              aria-invalid={Boolean(errors.title_ar)}
              aria-describedby={errors.title_ar ? "title_ar-error" : undefined}
              className={`${FIELD_CLASS} text-start`}
            />
          </Field>

          <Field
            id="title_en"
            label={dict.admin.fieldTitleEn}
            error={errors.title_en ? dict.fieldError[errors.title_en] : undefined}
          >
            <input
              id="title_en"
              name="title_en"
              dir="ltr"
              lang="en"
              required
              defaultValue={feature?.titleEn}
              onChange={(e) => setDraft((d) => ({ ...d, titleEn: e.target.value }))}
              aria-invalid={Boolean(errors.title_en)}
              aria-describedby={errors.title_en ? "title_en-error" : undefined}
              className={`${FIELD_CLASS} text-start`}
            />
          </Field>

          <Field id="description_ar" label={dict.admin.fieldDescriptionAr}>
            <textarea
              id="description_ar"
              name="description_ar"
              dir="rtl"
              lang="ar"
              rows={4}
              defaultValue={feature?.descriptionAr}
              className={`${FIELD_CLASS} resize-y text-start`}
            />
          </Field>

          <Field id="description_en" label={dict.admin.fieldDescriptionEn}>
            <textarea
              id="description_en"
              name="description_en"
              dir="ltr"
              lang="en"
              rows={4}
              defaultValue={feature?.descriptionEn}
              className={`${FIELD_CLASS} resize-y text-start`}
            />
          </Field>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field id="status" label={dict.admin.fieldStatus}>
            <select
              id="status"
              name="status"
              defaultValue={feature?.status ?? "under_review"}
              onChange={(e) =>
                setDraft((d) => ({ ...d, status: e.target.value as FeatureStatus }))
              }
              className={FIELD_CLASS}
            >
              {FEATURE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {dict.status[status]}
                </option>
              ))}
            </select>
          </Field>

          <Field id="category_id" label={dict.admin.fieldCategory}>
            <select
              id="category_id"
              name="category_id"
              defaultValue={feature?.categoryId ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value }))}
              className={FIELD_CLASS}
            >
              <option value="">{dict.admin.fieldCategoryNone}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === "ar" ? c.nameAr : c.nameEn}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-text">
          <input
            type="checkbox"
            name="is_pinned"
            defaultChecked={feature?.isPinned}
            onChange={(e) => setDraft((d) => ({ ...d, isPinned: e.target.checked }))}
            className="size-4 rounded-input accent-flovoo-blue"
          />
          {dict.admin.fieldPinned}
        </label>

        {/* The picture. It appears inside the feature's dialog, never on the
            board card — a card is a title and a vote count — and travels into
            the changelog draft when the feature ships. */}
        <fieldset className="flex flex-col gap-4 rounded-card border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-text">
            {dict.admin.fieldFeatureImage}
          </legend>

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-60 flex-1">
              <Field id="image_url" label={dict.admin.fieldImageUrl}>
              <input
                id="image_url"
                name="image_url"
                type="url"
                dir="ltr"
                value={image.url}
                onChange={(e) => setImage((current) => ({ ...current, url: e.target.value }))}
                  className={`${FIELD_CLASS} text-start`}
                />
              </Field>
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-control border border-border px-3 text-sm font-semibold text-text transition-colors duration-(--dur-micro) hover:bg-subtle"
            >
              <ImagePlus className="size-4" strokeWidth={2} aria-hidden />
              {dict.admin.chooseFromLibrary}
            </button>
          </div>

          {image.url ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field id="image_alt_ar" label={dict.admin.fieldImageAltAr}>
                  <input
                    id="image_alt_ar"
                    name="image_alt_ar"
                    dir="rtl"
                    lang="ar"
                    value={image.altAr}
                    onChange={(e) => setImage((current) => ({ ...current, altAr: e.target.value }))}
                    className={`${FIELD_CLASS} text-start`}
                  />
                </Field>
                <Field id="image_alt_en" label={dict.admin.fieldImageAltEn}>
                  <input
                    id="image_alt_en"
                    name="image_alt_en"
                    dir="ltr"
                    lang="en"
                    value={image.altEn}
                    onChange={(e) => setImage((current) => ({ ...current, altEn: e.target.value }))}
                    className={`${FIELD_CLASS} text-start`}
                  />
                </Field>
              </div>

              {/* Missing alt does not block the save — a roadmap card is not a
                  published article — but it is said out loud rather than
                  quietly accepted. */}
              {!image.altAr.trim() || !image.altEn.trim() ? (
                <p className="flex items-start gap-2 text-xs text-warning-label">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                  {dict.admin.imageAltMissing}
                </p>
              ) : null}

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={locale === "ar" ? image.altAr : image.altEn}
                className="block h-auto w-full max-w-md rounded-control border border-border"
              />
            </>
          ) : null}
        </fieldset>

        {state.status === "error" ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {dict.admin.saveFailed}
          </p>
        ) : null}

        {state.status === "saved" ? (
          <p role="status" className="text-sm font-medium text-stage-shipped-text">
            {dict.admin.saved}
            {state.notified > 0
              ? ` · ${t(dict.admin.notifiedCount, { count: state.notified })}`
              : ""}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/admin`}
            className="inline-flex h-10 items-center rounded-control border border-border px-4 text-sm font-semibold text-text-secondary transition-colors duration-(--dur-micro) hover:text-text"
          >
            {dict.admin.cancel}
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center gap-2 rounded-control bg-brand-solid px-4 text-sm font-semibold text-brand-solid-text shadow-sm transition-transform duration-(--dur-micro) hover:-translate-y-px disabled:opacity-70"
          >
            <Save className="size-4" strokeWidth={2} aria-hidden />
            {pending ? dict.admin.saving : dict.admin.save}
          </button>
        </div>
      </form>

      <aside className="min-w-0">
        <h2 className="label-caps mb-3 text-text-secondary">{dict.admin.preview}</h2>
        <div className="flex flex-col gap-4">
          <PreviewCard
            dir="rtl"
            lang="ar"
            langLabel={dict.admin.previewAr}
            title={draft.titleAr}
            status={draft.status}
            statusLabel={dict.status[draft.status]}
            categoryName={category?.nameAr ?? null}
            categoryColor={category?.color ?? null}
            votes={feature?.votes ?? 0}
            pinned={draft.isPinned}
            pinnedLabel={dict.admin.pinned}
          />
          <PreviewCard
            dir="ltr"
            lang="en"
            langLabel={dict.admin.previewEn}
            title={draft.titleEn}
            status={draft.status}
            statusLabel={dict.status[draft.status]}
            categoryName={category?.nameEn ?? null}
            categoryColor={category?.color ?? null}
            votes={feature?.votes ?? 0}
            pinned={draft.isPinned}
            pinnedLabel={dict.admin.pinned}
          />
        </div>
      </aside>

      {/* The help center's library: one media store for the whole app. */}
      <MediaPicker
        open={pickerOpen}
        items={library}
        locale={locale}
        dict={dict}
        onPick={(picked) => {
          setImage((current) => ({
            url: picked.src,
            // The library already holds a description per language; take it
            // rather than making somebody retype what is already written.
            altAr: current.altAr || (locale === "ar" ? picked.alt : ""),
            altEn: current.altEn || (locale === "en" ? picked.alt : ""),
          }));
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
        onUploaded={(item) => setLibrary((current) => [item, ...current])}
      />
    </div>
  );
}

/**
 * The public card, rendered in its own direction. `dir` is set here rather than
 * inherited so the Arabic preview mirrors correctly even while an admin works
 * in English, which is the whole point of showing both.
 */
function PreviewCard({
  dir,
  lang,
  langLabel,
  title,
  status,
  statusLabel,
  categoryName,
  categoryColor,
  votes,
  pinned,
  pinnedLabel,
}: {
  dir: "rtl" | "ltr";
  lang: string;
  langLabel: string;
  title: string;
  status: FeatureStatus;
  statusLabel: string;
  categoryName: string | null;
  categoryColor: string | null;
  votes: number;
  pinned: boolean;
  pinnedLabel: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-text-tertiary">{langLabel}</p>
      <div className="rounded-control bg-column p-2">
        <div className="flex items-center justify-between gap-2 px-1 py-1.5" dir={dir}>
          <StatusBadge status={status} label={statusLabel} />
        </div>
        <article
          dir={dir}
          lang={lang}
          className="rounded-control border border-border bg-card p-3 shadow-sm"
        >
          <h3 className="line-clamp-3 text-sm/5 font-semibold text-text">
            {title || "—"}
          </h3>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {categoryName && categoryColor ? (
                <CategoryChip name={categoryName} color={categoryColor} />
              ) : null}
              {pinned ? (
                <span className="text-xs font-medium text-text-tertiary">
                  {pinnedLabel}
                </span>
              ) : null}
            </div>
            <span className="inline-flex h-[30px] w-16 items-center justify-center gap-1 rounded-control border border-border bg-subtle text-sm font-medium text-text">
              <ChevronUp className="size-4" strokeWidth={2} aria-hidden />
              <span className="numeral">{votes}</span>
            </span>
          </div>
        </article>
      </div>

    </div>
  );
}