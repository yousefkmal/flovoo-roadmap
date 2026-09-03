import { notFound } from "next/navigation";

import { FeatureEditor, type EditorFeature } from "@/components/admin/FeatureEditor";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getFeatureById } from "@/lib/data/admin-repository";
import { getCategories } from "@/lib/data/repository";

/**
 * One route for both creating and editing: `/admin/features/new` renders an
 * empty form, any other id loads that feature. The form is identical either
 * way, so splitting it into two routes would only duplicate it.
 */
export default async function FeatureEditorPage({
  params,
}: PageProps<"/[locale]/admin/features/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const categories = await getCategories();

  let feature: EditorFeature | null = null;
  if (id !== "new") {
    const found = await getFeatureById(id);
    if (!found) notFound();
    feature = {
      id: found.id,
      titleAr: found.title_ar,
      titleEn: found.title_en,
      descriptionAr: found.description_ar ?? "",
      descriptionEn: found.description_en ?? "",
      status: found.status,
      categoryId: found.category_id,
      isPinned: found.is_pinned,
      votes: found.vote_count,
    };
  }

  return (
    <main className="mx-auto w-full max-w-board px-5 py-8 lg:px-10">
      <h1 className="mb-6 text-2xl/8 font-bold text-text">
        {feature ? dict.admin.editorTitleEdit : dict.admin.editorTitleNew}
      </h1>

      <FeatureEditor
        feature={feature}
        categories={categories.map((c) => ({
          id: c.id,
          nameAr: c.name_ar,
          nameEn: c.name_en,
          color: c.color,
        }))}
        locale={locale}
        dict={dict}
      />
    </main>
  );
}
