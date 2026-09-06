import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { HelpShell } from "@/components/help/HelpShell";
import { JsonLd } from "@/components/help/JsonLd";
import { SiteFooter } from "@/components/SiteFooter";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getHelpNavigation, getPublishedArticlesForExport } from "@/lib/data/help-repository";
import { helpArticleHref, helpFooterLinks, helpHomeHref } from "@/lib/help/paths";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  definedTermJsonLd,
  definedTerms,
  helpOgImageUrl,
  helpSocialMetadata,
} from "@/lib/help/seo";
import { siteUrl } from "@/lib/site";

/**
 * Every Definition block in the corpus, on one page.
 *
 * Built rather than written: a term defined inside an article is the same term
 * here, so the glossary can never drift from the articles. "What is a WABA?"
 * is one of the commonest questions put to an assistant, and Arabic technical
 * glossaries are thin enough that a clear one is worth having on its own page.
 */
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/help/glossary">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.help.glossaryTitle,
    description: dict.help.glossaryLead,
    alternates: {
      canonical: `${helpHomeHref(locale)}/glossary`,
      languages: { ar: `${helpHomeHref("ar")}/glossary`, en: `${helpHomeHref("en")}/glossary` },
    },
    ...helpSocialMetadata({
      locale,
      title: dict.help.glossaryTitle,
      description: dict.help.glossaryLead,
      url: `${helpHomeHref(locale)}/glossary`,
      image: helpOgImageUrl(locale, dict.help.glossaryTitle, dict.help.name, null),
      siteName: dict.help.name,
    }),
  };
}

export default async function HelpGlossaryPage({ params }: PageProps<"/[locale]/help/glossary">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const [navigation, articles] = await Promise.all([
    getHelpNavigation(locale),
    getPublishedArticlesForExport(locale),
  ]);

  // One entry per term. The first article to define it is where it links.
  const entries = new Map<string, { description: string; slug: string; title: string }>();
  for (const article of articles) {
    for (const term of definedTerms(article.body)) {
      if (entries.has(term.term)) continue;
      entries.set(term.term, {
        description: term.description,
        slug: article.slug,
        title: article.title,
      });
    }
  }
  const sorted = [...entries.entries()].sort((a, b) => a[0].localeCompare(b[0], locale));

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: dict.help.name, href: helpHomeHref(locale) },
          { name: dict.help.glossaryTitle, href: `${helpHomeHref(locale)}/glossary` },
        ])}
      />
      {sorted.length > 0 ? (
        <JsonLd
          data={definedTermJsonLd(
            sorted.map(([term, entry]) => ({ term, description: entry.description })),
            locale,
          )}
        />
      ) : null}

      <HelpShell locale={locale} collections={navigation} active={{ collectionId: null, articleId: null }}>
        <main className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-10">
          <h1 className="text-2xl font-bold leading-tight text-text">{dict.help.glossaryTitle}</h1>
          <p className="mt-3 text-base leading-7 text-text-secondary">{dict.help.glossaryLead}</p>

          {sorted.length === 0 ? (
            <p className="mt-6 text-sm text-text-tertiary">{dict.help.glossaryEmpty}</p>
          ) : (
            <dl className="mt-6 flex flex-col gap-4">
              {sorted.map(([term, entry]) => (
                <div key={term} className="rounded-card border border-border bg-card p-4">
                  <dt className="font-bold text-text">{term}</dt>
                  <dd className="mt-1 text-sm leading-6 text-text-secondary">
                    {entry.description}
                    <Link
                      href={helpArticleHref(locale, entry.slug)}
                      className="ms-2 text-link hover:underline"
                    >
                      {entry.title}
                    </Link>
                  </dd>
                </div>
              ))}
            </dl>
          )}
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
