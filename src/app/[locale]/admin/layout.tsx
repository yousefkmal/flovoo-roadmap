import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

import { AdminNav } from "@/components/admin/AdminNav";
import { FlovooLogo } from "@/components/FlovooLogo";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getAdminSession } from "@/lib/auth/admin";
import { getPendingSubmissionCount } from "@/lib/data/admin-repository";

/** The admin side is never cached: it is per-admin and always reads live rows. */
export const dynamic = "force-dynamic";

/**
 * The guard for every admin page.
 *
 * A layout check is necessary but not sufficient — each admin action re-checks
 * the session too, because a Server Action is reachable whether or not a page
 * renders a button for it.
 */
export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const session = await getAdminSession();

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-20 text-center">
        <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-warning-tint text-warning-label">
          <ShieldAlert className="size-6" strokeWidth={2} aria-hidden />
        </span>
        <h1 className="text-xl font-bold text-text">{dict.admin.forbiddenTitle}</h1>
        <p className="mt-2 text-sm text-text-secondary">{dict.admin.forbiddenBody}</p>
        <Link
          href={`/${locale}`}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-control border border-border px-4 text-sm font-semibold text-text-secondary transition-colors duration-(--dur-micro) hover:text-text"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" strokeWidth={2} aria-hidden />
          {dict.admin.backToPortal}
        </Link>
      </main>
    );
  }

  const pending = await getPendingSubmissionCount();

  return (
    <>
      <header className="border-b border-border bg-card">
        <div className="mx-auto w-full max-w-board px-5 lg:px-10">
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FlovooLogo name={dict.site.name} />
              <span className="rounded-control bg-subtle px-2 py-1 text-xs font-semibold text-text-secondary">
                {dict.admin.title}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-text-tertiary sm:inline">
                {session.user.email}
              </span>
              <Link
                href={`/${locale}`}
                className="inline-flex h-9 items-center gap-2 rounded-control border border-border px-3 text-sm font-semibold text-text-secondary transition-colors duration-(--dur-micro) hover:text-text"
              >
                <ArrowLeft className="size-4 rtl:-scale-x-100" strokeWidth={2} aria-hidden />
                <span className="hidden sm:inline">{dict.admin.backToPortal}</span>
              </Link>
            </div>
          </div>

          <AdminNav
            locale={locale}
            pending={pending}
            labels={{
              board: dict.admin.board,
              submissions: dict.admin.submissions,
              changelog: dict.admin.changelog,
            }}
          />
        </div>
      </header>

      {children}
    </>
  );
}
