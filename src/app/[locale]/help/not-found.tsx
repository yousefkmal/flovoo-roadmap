import Link from "next/link";
import { locale as rootLocale } from "next/root-params";
import { SearchX } from "lucide-react";

import { CollectionCard } from "@/components/help/CollectionCard";
import { HelpHeader } from "@/components/help/HelpHeader";
import { HelpSearch } from "@/components/help/HelpSearch";
import { HelpShell } from "@/components/help/HelpShell";
import { SiteFooter } from "@/components/SiteFooter";
import { getDictionary } from "@/i18n";
import { DEFAULT_LOCALE, isLocale, otherLocale } from "@/i18n/config";
import {
  getHelpCollectionsWithCounts,
  getHelpNavigation,
} from "@/lib/data/help-repository";
import { helpSearchLabels } from "@/lib/help/labels";
import { articleCountLabel } from "@/lib/help/format";
import {
  helpCollectionHref,
  helpFooterLinks,
  helpHomeHref,
  helpSearchHref,
} from "@/lib/help/paths";
import { siteUrl } from "@/lib/site";

/**
 * P5 — an article or topic that does not exist. A not-found boundary receives
 * no params, so the locale comes from `next/root-params`, which reads the
 * `[locale]` segment without opting the route out of prerendering — reading
 * `headers()` here did exactly that and turned every help page dynamic.
 *
 * Phase 4 puts the redirect lookup in front of this page and prefills the
 * search with the old slug. For now it offers the search and the topics.
 */
export default async function HelpNotFound() {
  const requested = await rootLocale();
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const [collections, navigation] = await Promise.all([
    getHelpCollectionsWithCounts(locale),
    getHelpNavigation(locale),
  ]);
  const active = { collectionId: null, articleId: null };

  return (
    <>
      <HelpHeader
        locale={locale}
        alternateHref={helpHomeHref(otherLocale(locale))}
        collections={navigation}
        active={active}
        showSearch={false}
      />

      <HelpShell locale={locale} collections={navigation} active={active}>
        <main className="flex-1 px-4 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-3xl">
            <div className="mx-auto max-w-xl text-center">
              <span className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-subtle text-muted">
                <SearchX className="size-6" strokeWidth={2} aria-hidden />
              </span>
              <h1 className="text-2xl font-bold text-text">{dict.help.notFoundTitle}</h1>
              <p className="mt-2 text-sm text-text-secondary">{dict.help.notFoundBody}</p>
              <HelpSearch
                locale={locale}
                variant="hero"
                action={helpSearchHref(locale)}
                labels={helpSearchLabels(dict)}
                className="mt-6"
              />
              <Link
                href={helpHomeHref(locale)}
                className="mt-4 inline-flex h-9 items-center rounded-control border border-border px-4 text-sm font-semibold text-text-secondary transition-colors duration-(--dur-micro) hover:text-text"
              >
                {dict.help.notFoundHome}
              </Link>
            </div>

            <section aria-labelledby="help-notfound-browse" className="mt-10">
              <h2 id="help-notfound-browse" className="mb-3 text-base font-bold text-text">
                {dict.help.browseTitle}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {collections.map((collection) => (
                  <li key={collection.id}>
                    <CollectionCard
                      href={helpCollectionHref(locale, collection.slug)}
                      name={locale === "ar" ? collection.name_ar : collection.name_en}
                      description={
                        locale === "ar" ? collection.description_ar : collection.description_en
                      }
                      icon={collection.icon}
                      countLabel={articleCountLabel(dict, locale, collection.articleCount)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </main>
      </HelpShell>

      <SiteFooter
        locale={locale}
        updatedAt={null}
        links={helpFooterLinks(locale, siteUrl(), {
          about: dict.help.aboutTitle,
          glossary: dict.help.glossaryTitle,
          roadmap: dict.help.roadmapLink,
          updates: dict.nav.updates,
        })}
      />
    </>
  );
}
