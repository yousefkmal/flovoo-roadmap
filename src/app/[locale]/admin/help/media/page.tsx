import { notFound } from "next/navigation";

import { HelpMediaLibrary } from "@/components/admin/help/HelpMediaLibrary";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getAdminHelpMedia } from "@/lib/data/help-admin-repository";
import { formatDate } from "@/lib/format";
import { mediaPublicUrl } from "@/lib/help/media";
import { requireAdminPage } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export default async function HelpMediaPage({ params }: PageProps<"/[locale]/admin/help/media">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPage();
  const dict = getDictionary(locale);
  const media = await getAdminHelpMedia();

  return (
    <main className="mx-auto w-full max-w-board px-5 py-8 lg:px-10">
      <h1 className="text-2xl/8 font-bold text-text">{dict.adminHelp.mediaTitle}</h1>
      <HelpMediaLibrary
        locale={locale}
        dict={dict}
        items={media.map((m) => ({
          id: m.id,
          url: mediaPublicUrl(m.storage_path),
          altAr: m.alt_ar ?? "",
          altEn: m.alt_en ?? "",
          width: m.width,
          height: m.height,
          usageCount: m.usageCount,
          createdLabel: formatDate(m.created_at, locale),
        }))}
      />
    </main>
  );
}
