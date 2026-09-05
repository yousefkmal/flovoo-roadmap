import { notFound, permanentRedirect, redirect } from "next/navigation";

import { isLocale } from "@/i18n/config";
import { helpSearchHref } from "@/lib/help/paths";
import { followHelpRedirect, humanizeLegacySlug, noteHelpNotFound } from "@/lib/help/redirects";

/**
 * Anything under the help center that is not a real page: old Intercom
 * addresses, mistyped links, bookmarks from before a rename. A configured
 * redirect is followed with its status and counted; anything else is noted
 * for the redirects manager and sent to search with the old slug as the
 * query, so the reader still lands near what they wanted (brief §8.7).
 *
 * Real article and topic slugs never reach this route — their own pages
 * consult the same redirect table before giving up.
 */
export const dynamic = "force-dynamic";

export default async function HelpLegacyPage({
  params,
}: PageProps<"/[locale]/help/[...legacy]">) {
  const { locale, legacy } = await params;
  if (!isLocale(locale)) notFound();

  const publicPath = `/${locale}/${legacy.map((segment) => encodeURIComponent(decodeURIComponent(segment))).join("/")}`;

  const hit = await followHelpRedirect(locale, publicPath);
  if (hit) {
    if (hit.statusCode === 302) redirect(hit.href);
    permanentRedirect(hit.href);
  }

  await noteHelpNotFound(publicPath);

  const query = humanizeLegacySlug(publicPath);
  if (!query) notFound();
  redirect(`${helpSearchHref(locale)}?q=${encodeURIComponent(query)}&from=404`);
}
