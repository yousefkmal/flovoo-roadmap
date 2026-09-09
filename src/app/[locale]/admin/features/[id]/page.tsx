import { notFound } from "next/navigation";

import { FeatureEditor, type EditorFeature } from "@/components/admin/FeatureEditor";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getAdminHelpMedia } from "@/lib/data/help-admin-repository";
import { getFeatureById } from "@/lib/data/admin-repository";
import { mediaPublicUrl } from "@/lib/help/media";
import { getCategories } from "@/lib/data/repository";
import { requireAdminPage } from "@/lib/auth/admin";

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
  await requireAdminPage();

  const dict = getDictionary(locale);
  const [categories, media] = await Promise.all([getCategories(), getAdminHelpMedia()]);

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
      imageUrl: found.image_url ?? "",
      imageAltAr: found.image_alt_ar ?? "",
      imageAltEn: found.image_alt_en ?? "",
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
        media={media.map((m) => ({
          id: m.id,
          url: mediaPublicUrl(m.storage_path),
          altAr: m.alt_ar ?? "",
          altEn: m.alt_en ?? "",
          width: m.width,
          height: m.height,
        }))}
      />
    </main>
  );
}
