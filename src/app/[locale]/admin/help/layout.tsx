import { notFound } from "next/navigation";

import { HelpAdminNav } from "@/components/admin/help/HelpAdminNav";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";

/**
 * The help center inside the admin. The parent admin layout is the guard; this
 * one only adds the section's own navigation. Every action under here
 * re-checks the session itself.
 */
export default async function HelpAdminLayout({
  children,
  params,
}: LayoutProps<"/[locale]/admin/help">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <>
      <div className="border-b border-border bg-column">
        <div className="mx-auto w-full max-w-board px-5 py-2.5 lg:px-10">
          <HelpAdminNav
            locale={locale}
            labels={{
              articles: dict.adminHelp.navArticles,
              collections: dict.adminHelp.navCollections,
              media: dict.adminHelp.navMedia,
              redirects: dict.adminHelp.navRedirects,
              analytics: dict.adminHelp.navAnalytics,
              aiVisibility: dict.adminHelp.navAiVisibility,
            }}
          />
        </div>
      </div>
      {children}
    </>
  );
}
