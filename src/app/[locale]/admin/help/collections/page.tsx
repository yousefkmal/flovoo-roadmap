import { notFound } from "next/navigation";

import { HelpCollectionsManager } from "@/components/admin/help/HelpCollectionsManager";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import {
  getAdminHelpCollections,
  getHelpCollectionArticleCounts,
} from "@/lib/data/help-admin-repository";
import { requireAdminPage } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export default async function HelpCollectionsPage({
  params,
}: PageProps<"/[locale]/admin/help/collections">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPage();
  const dict = getDictionary(locale);

  const [collections, counts] = await Promise.all([
    getAdminHelpCollections(),
    getHelpCollectionArticleCounts(),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-10">
      <h1 className="text-2xl/8 font-bold text-text">{dict.adminHelp.collectionsTitle}</h1>
      <HelpCollectionsManager
        key={collections.map((c) => c.id).join("|")}
        collections={collections.map((c) => ({ ...c, articleCount: counts.get(c.id) ?? 0 }))}
        locale={locale}
        dict={dict}
      />
    </main>
  );
}
