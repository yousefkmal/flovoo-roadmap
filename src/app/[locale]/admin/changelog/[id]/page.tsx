import { notFound } from "next/navigation";

import {
  ChangelogEditor,
  type ChangelogEditorEntry,
} from "@/components/admin/ChangelogEditor";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getAllFeatures, getChangelogEntryById } from "@/lib/data/admin-repository";

export default async function ChangelogEditorPage({
  params,
}: PageProps<"/[locale]/admin/changelog/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const features = await getAllFeatures();

  let entry: ChangelogEditorEntry | null = null;
  if (id !== "new") {
    const found = await getChangelogEntryById(id);
    if (!found) notFound();
    entry = {
      id: found.id,
      kind: found.kind,
      titleAr: found.title_ar,
      titleEn: found.title_en,
      bodyAr: found.body_ar ?? "",
      bodyEn: found.body_en ?? "",
      imageUrl: found.image_url ?? "",
      imageAltAr: found.image_alt_ar ?? "",
      imageAltEn: found.image_alt_en ?? "",
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
