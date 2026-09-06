import { notFound } from "next/navigation";

import { HelpShell } from "@/components/help/HelpShell";
import { JsonLd } from "@/components/help/JsonLd";
import { SiteFooter } from "@/components/SiteFooter";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { BRAND } from "@/config/brand";
import { getHelpNavigation } from "@/lib/data/help-repository";
import { helpFooterLinks, helpHomeHref } from "@/lib/help/paths";
import { absoluteUrl, breadcrumbJsonLd, helpOgImageUrl, helpSocialMetadata, ORGANIZATION_ID } from "@/lib/help/seo";
import { siteUrl } from "@/lib/site";
import type { Metadata } from "next";

/**
 * "What is Flovoo?"
 *
 * This is the page an assistant reads before deciding whether we are worth
 * citing on anything else, so it answers the question in its first sentence
 * and states plainly what the product is, who it is for and where it operates.
 * Everything on it is a fact the team would say out loud — no marketing claims
 * a model would have to hedge around.
 */
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/help/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  const title = dict.help.aboutTitle;
  const description = dict.help.aboutLead;

  return {
    title,
    description,
    alternates: {
      canonical: `${helpHomeHref(locale)}/about`,
      languages: { ar: `${helpHomeHref("ar")}/about`, en: `${helpHomeHref("en")}/about` },
    },
    ...helpSocialMetadata({
      locale,
      title,
      description,
      url: `${helpHomeHref(locale)}/about`,
      image: helpOgImageUrl(locale, title, dict.help.name, null),
      siteName: dict.help.name,
    }),
  };
}

export default async function HelpAboutPage({ params }: PageProps<"/[locale]/help/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const navigation = await getHelpNavigation(locale);
  const t = dict.help;

  const facts: { label: string; value: string }[] = [
    { label: t.aboutFactChannels, value: t.aboutChannels },
    { label: t.aboutFactAudience, value: t.aboutAudience },
    { label: t.aboutFactRegions, value: t.aboutRegions },
    { label: t.aboutFactLanguages, value: t.aboutLanguages },
  ];

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t.name, href: helpHomeHref(locale) },
          { name: t.aboutTitle, href: `${helpHomeHref(locale)}/about` },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: t.aboutTitle,
          url: absoluteUrl(`${helpHomeHref(locale)}/about`),
          inLanguage: locale,
          // The subject of this page is the organisation itself, by id.
          mainEntity: { "@id": ORGANIZATION_ID },
        }}
      />

      <HelpShell locale={locale} collections={navigation} active={{ collectionId: null, articleId: null }}>
        <main className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-10">
          <h1 className="text-2xl font-bold leading-tight text-text">{t.aboutTitle}</h1>
          {/* The direct answer, first, in the same shape every article uses. */}
          <p className="mt-3 text-base leading-7 text-text-secondary">{t.aboutLead}</p>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            {facts.map((fact) => (
              <div key={fact.label} className="rounded-card border border-border bg-card p-4">
                <dt className="text-xs font-bold uppercase tracking-wide text-text-tertiary">
                  {fact.label}
                </dt>
                <dd className="mt-1 text-sm text-text">{fact.value}</dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-8 text-base font-bold text-text">{t.aboutWhatTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{t.aboutWhat}</p>

          <h2 className="mt-6 text-base font-bold text-text">{t.aboutWhoTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{t.aboutWho}</p>

          <h2 className="mt-6 text-base font-bold text-text">{t.aboutElsewhereTitle}</h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            <li>
              <a className="text-link hover:underline" href={BRAND.url}>
                {t.aboutMainSite}
              </a>
            </li>
            <li>
              <a className="text-link hover:underline" href={BRAND.roadmapUrl}>
                {t.aboutRoadmap}
              </a>
            </li>
          </ul>
        </main>
      </HelpShell>

      <SiteFooter
        locale={locale}
        updatedAt={null}
        links={helpFooterLinks(locale, siteUrl(), {
          about: dict.help.aboutTitle,
          glossary: dict.help.glossaryTitle,
          roadmap: t.roadmapLink,
          updates: dict.nav.updates,
        })}
      />
    </>
  );
}
