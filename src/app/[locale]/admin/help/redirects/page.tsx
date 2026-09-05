import { notFound } from "next/navigation";

import { HelpRedirectsManager } from "@/components/admin/help/HelpRedirectsManager";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { requireAdminPage } from "@/lib/auth/admin";
import { getAdminHelpNotFound, getAdminHelpRedirects } from "@/lib/data/help-admin-repository";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HelpRedirectsPage({
  params,
}: PageProps<"/[locale]/admin/help/redirects">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPage();
  const dict = getDictionary(locale);

  const [redirects, missing] = await Promise.all([getAdminHelpRedirects(), getAdminHelpNotFound()]);

  return (
    <main className="mx-auto w-full max-w-board px-5 py-8 lg:px-10">
      <h1 className="text-2xl/8 font-bold text-text">{dict.adminHelp.navRedirects}</h1>
      <HelpRedirectsManager
        locale={locale}
        dict={dict}
        redirects={redirects.map((r) => ({
          id: r.id,
          sourcePath: r.source_path,
          targetPath: r.target_path,
          statusCode: r.status_code,
          hits: r.hits,
          createdLabel: formatDate(r.created_at, locale),
        }))}
        notFound={missing.map((m) => ({
          path: m.path,
          hits: m.hits,
          lastSeenLabel: formatDate(m.last_seen, locale),
        }))}
      />
    </main>
  );
}
