import { notFound } from "next/navigation";

import {
  ChangelogEditor,
  type ChangelogEditorEntry,
} from "@/components/admin/ChangelogEditor";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getAllFeatures, getChangelogEntryById } from "@/lib/data/admin-repository";
import { getAdminHelpMedia } from "@/lib/data/help-admin-repository";
import { mediaPublicUrl } from "@/lib/help/media";
import { toChangelogBody } from "@/lib/changelog/body";
import { requireAdminPage } from "@/lib/auth/admin";

export default async function ChangelogEditorPage({
  params,
}: PageProps<"/[locale]/admin/changelog/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPage();

  const dict = getDictionary(locale);
  const [features, media] = await Promise.all([getAllFeatures(), getAdminHelpMedia()]);

  let entry: ChangelogEditorEntry | null = null;
  if (id !== "new") {
    const found = await getChangelogEntryById(id);
    if (!found) notFound();
    entry = {
      id: found.id,
      kind: found.kind,
      titleAr: found.title_ar,
      titleEn: found.title_en,
      bodyAr: toChangelogBody(found.body_ar),
      bodyEn: toChangelogBody(found.body_en),
      imageUrl: found.image_url ?? "",
      imageUrlEn: found.image_url_en ?? "",
      imageAltAr: found.image_alt_ar ?? "",
      imageAltEn: found.image_alt_en ?? "",
      coverAltNeedsReview: found.cover_alt_needs_review,
      articleUrl: found.article_url ?? "",
      actionUrl: found.action_url ?? "",
      actionLabelAr: found.action_label_ar ?? "",
      actionLabelEn: found.action_label_en ?? "",
      featureId: found.feature_id,
    };
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-10">
      <h1 className="text-2xl/8 font-bold text-text">
        {entry ? dict.admin.editorTitleEditEntry : dict.admin.editorTitleNewEntry}
      </h1>

      <ChangelogEditor
        entry={entry}
        media={media.map((m) => ({
          id: m.id,
          url: mediaPublicUrl(m.storage_path),
          altAr: m.alt_ar ?? "",
          altEn: m.alt_en ?? "",
          width: m.width,
          height: m.height,
        }))}
        features={features.map((feature) => ({
          id: feature.id,
          title: locale === "ar" ? feature.title_ar : feature.title_en,
        }))}
        locale={locale}
        dict={dict}
      />
    </main>
  );
}
