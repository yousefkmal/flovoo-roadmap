"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Save } from "lucide-react";

import { FIELD_CLASS, Field } from "@/components/ui/Field";
import { saveChangelogAction, type ChangelogState } from "@/app/[locale]/admin/actions";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { CHANGELOG_KINDS, type ChangelogKind } from "@/lib/types";

export interface ChangelogEditorEntry {
  id: string;
  kind: ChangelogKind;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  imageUrl: string;
  imageAltAr: string;
  imageAltEn: string;
  articleUrl: string;
  actionUrl: string;
  actionLabelAr: string;
  actionLabelEn: string;
  featureId: string | null;
}

export interface EditorFeatureOption {
  id: string;
  title: string;
}

/**
 * The changelog entry editor.
 *
 * Same shape as the feature editor: Arabic and English side by side, and the
 * server refuses a half-translated save. Everything below the body is optional
 * — an entry is a title and some text; the cover, the links and the linked
 * feature are all things it may or may not have.
 */
export function ChangelogEditor({
  entry,
  features,
  locale,
  dict,
}: {
  entry: ChangelogEditorEntry | null;
  features: EditorFeatureOption[];
  locale: Locale;
  dict: Dictionary;
}) {
  const [state, formAction, pending] = useActionState<ChangelogState, FormData>(
    saveChangelogAction.bind(null, locale, entry?.id ?? null),
    { status: "idle" },
  );

  const errors = state.status === "invalid" ? state.errors : {};

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="kind" label={dict.admin.fieldKind}>
          <select id="kind" name="kind" defaultValue={entry?.kind ?? "new"} className={FIELD_CLASS}>
            {CHANGELOG_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {dict.updates[kind]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="feature_id" label={dict.admin.fieldFeature}>
          <select
            id="feature_id"
            name="feature_id"
            defaultValue={entry?.featureId ?? ""}
            className={FIELD_CLASS}
          >
            <option value="">{dict.admin.fieldFeatureNone}</option>
            {features.map((feature) => (
              <option key={feature.id} value={feature.id}>
                {feature.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

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
            defaultValue={entry?.titleAr}
            aria-invalid={Boolean(errors.title_ar)}
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
            defaultValue={entry?.titleEn}
            aria-invalid={Boolean(errors.title_en)}
            className={`${FIELD_CLASS} text-start`}
          />
        </Field>

        <Field id="body_ar" label={dict.admin.fieldBodyAr}>
          <textarea
            id="body_ar"
            name="body_ar"
            dir="rtl"
            lang="ar"
            rows={7}
            defaultValue={entry?.bodyAr}
            className={`${FIELD_CLASS} resize-y text-start`}
          />
        </Field>

        <Field id="body_en" label={dict.admin.fieldBodyEn}>
          <textarea
            id="body_en"
            name="body_en"
            dir="ltr"
            lang="en"
            rows={7}
            defaultValue={entry?.bodyEn}
            className={`${FIELD_CLASS} resize-y text-start`}
          />
        </Field>
      </div>

      <Field id="image_url" label={dict.admin.fieldImageUrl} hint={dict.admin.urlHint}>
        <input
          id="image_url"
          name="image_url"
          type="url"
          dir="ltr"
          defaultValue={entry?.imageUrl}
          className={`${FIELD_CLASS} text-start`}
        />
      </Field>

      <div className="grid gap-5 md:grid-cols-2">
        <Field
          id="image_alt_ar"
          label={dict.admin.fieldImageAltAr}
          hint={dict.admin.altHint}
        >
          <input
            id="image_alt_ar"
            name="image_alt_ar"
            dir="rtl"
            lang="ar"
            defaultValue={entry?.imageAltAr}
            className={`${FIELD_CLASS} text-start`}
          />
        </Field>

        <Field id="image_alt_en" label={dict.admin.fieldImageAltEn}>
          <input
            id="image_alt_en"
            name="image_alt_en"
            dir="ltr"
            lang="en"
            defaultValue={entry?.imageAltEn}
            className={`${FIELD_CLASS} text-start`}
          />
        </Field>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field id="article_url" label={dict.admin.fieldArticleUrl} hint={dict.admin.urlHint}>
          <input
            id="article_url"
            name="article_url"
            type="url"
            dir="ltr"
            defaultValue={entry?.articleUrl}
            className={`${FIELD_CLASS} text-start`}
          />
        </Field>

        <Field id="action_url" label={dict.admin.fieldActionUrl} hint={dict.admin.urlHint}>
          <input
            id="action_url"
            name="action_url"
            type="url"
            dir="ltr"
            defaultValue={entry?.actionUrl}
            className={`${FIELD_CLASS} text-start`}
          />
        </Field>

        <Field id="action_label_ar" label={dict.admin.fieldActionLabelAr}>
          <input
            id="action_label_ar"
            name="action_label_ar"
            dir="rtl"
            lang="ar"
            defaultValue={entry?.actionLabelAr}
            className={`${FIELD_CLASS} text-start`}
          />
        </Field>

        <Field id="action_label_en" label={dict.admin.fieldActionLabelEn}>
          <input
            id="action_label_en"
            name="action_label_en"
            dir="ltr"
            lang="en"
            defaultValue={entry?.actionLabelEn}
            className={`${FIELD_CLASS} text-start`}
          />
        </Field>
      </div>

      {state.status === "error" ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {dict.admin.saveFailed}
        </p>
      ) : null}

      {state.status === "saved" ? (
        <p role="status" className="text-sm font-medium text-stage-shipped-text">
          {dict.admin.saved}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Link
          href={`/${locale}/admin/changelog`}
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
  );
}
