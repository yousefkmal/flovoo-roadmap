import { CopyPageMenu } from "@/components/help/CopyPageMenu";
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { CalendarDays, Clock } from "lucide-react";

import { ArticleBody } from "@/components/help/ArticleBody";
import { JsonLd } from "@/components/help/JsonLd";
import { ArticleFeedback } from "@/components/help/ArticleFeedback";
import { Breadcrumbs } from "@/components/help/Breadcrumbs";
import { EscalationCard } from "@/components/help/EscalationCard";
import { HelpHeader } from "@/components/help/HelpHeader";
import { HelpShell } from "@/components/help/HelpShell";
import { PrevNextNav } from "@/components/help/PrevNextNav";
import { RelatedArticles } from "@/components/help/RelatedArticles";
import { TableOfContents } from "@/components/help/TableOfContents";
import { ViewTracker } from "@/components/help/ViewTracker";
import { SiteFooter } from "@/components/SiteFooter";
import { getDictionary, t } from "@/i18n";
import { LOCALES, isLocale, otherLocale } from "@/i18n/config";
import {
  getHelpArticleBySlug,
  getHelpArticleSlugs,
  getHelpNavigation,
} from "@/lib/data/help-repository";
import { formatDate } from "@/lib/format";
import { readingTimeLabel } from "@/lib/help/format";
import { mediaPublicUrl } from "@/lib/help/media";
import { followHelpRedirect, noteHelpNotFound } from "@/lib/help/redirects";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  faqPageJsonLd,
  faqPairs,
  definedTermJsonLd,
  definedTerms,
  helpOgImageUrl,
  helpRobots,
  helpSocialMetadata,
  techArticleJsonLd,
} from "@/lib/help/seo";
import { helpFeedbackLabels } from "@/lib/help/labels";
import { getRelatedHelpArticles } from "@/lib/help/search";
import {
  decodeSlug,
  helpArticleHref,
  helpCollectionHref,
  helpFooterLinks,
  helpHomeHref,
} from "@/lib/help/paths";
import { siteUrl } from "@/lib/site";

/**
 * P3 — the article, which is where most readers land. Static, regenerated in
 * the background; slugs that were not known at build time render on first
 * request and are cached from then on.
 */
export const revalidate = 300;

export async function generateStaticParams() {
  const perLocale = await Promise.all(
    LOCALES.map(async (locale) =>
      (await getHelpArticleSlugs(locale)).map((slug) => ({ locale, slug })),
    ),
  );
  return perLocale.flat();
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/help/articles/[slug]">): Promise<Metadata> {
  const { locale, slug: rawSlug } = await params;
  if (!isLocale(locale)) return {};
  const article = await getHelpArticleBySlug(locale, decodeSlug(rawSlug));
  if (!article) return {};

  const dict = getDictionary(locale);
  const languages: Record<string, string> = {
    [locale]: helpArticleHref(locale, article.slug),
  };
  if (article.alternate) {
    languages[article.alternate.locale] = helpArticleHref(
      article.alternate.locale,
      article.alternate.slug,
    );
  }
  languages["x-default"] = languages.ar ?? languages[locale];

  const collectionName =
    locale === "ar" ? article.collection.name_ar : article.collection.name_en;
  // One sentence maintained once: the summary is the lead paragraph, the meta
  // description and the JSON-LD description, rather than three copies drifting.
  const description =
    article.answerSummary ?? article.metaDescription ?? article.excerpt ?? dict.help.metaDescription;
  const image = helpOgImageUrl(
    locale,
    article.title,
    collectionName,
    article.ogImagePath ? mediaPublicUrl(article.ogImagePath) : null,
  );

  return {
    title: article.metaTitle ?? article.title,
    description,
    alternates: {
      canonical: helpArticleHref(locale, article.slug),
      languages,
    },
    robots: helpRobots,
    ...helpSocialMetadata({
      locale,
      title: article.metaTitle ?? article.title,
      description,
      url: helpArticleHref(locale, article.slug),
      image,
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      siteName: dict.help.name,
    }),
  };
}

export default async function HelpArticlePage({
  params,
}: PageProps<"/[locale]/help/articles/[slug]">) {
  const { locale, slug: rawSlug } = await params;
  if (!isLocale(locale)) notFound();

  const slug = decodeSlug(rawSlug);
  const article = await getHelpArticleBySlug(locale, slug);
  if (!article) {
    // An old address for a renamed article follows its redirect; anything
    // else is recorded for the redirects manager before the 404.
    const publicPath = `/${locale}/articles/${encodeURIComponent(slug)}`;
    const hit = await followHelpRedirect(locale, publicPath);
    if (hit) {
      if (hit.statusCode === 302) redirect(hit.href);
      permanentRedirect(hit.href);
    }
    await noteHelpNotFound(publicPath);
    notFound();
  }

  const dict = getDictionary(locale);
  const other = otherLocale(locale);
  const [navigation, related] = await Promise.all([
    getHelpNavigation(locale),
    getRelatedHelpArticles(locale, article.id),
  ]);
  const active = { collectionId: article.collection.id, articleId: article.id };
  const collectionName =
    locale === "ar" ? article.collection.name_ar : article.collection.name_en;

  // The other language: the same article when it exists, otherwise its topic
  // with a flag that makes the category page explain why the reader is there.
  const alternateHref = article.alternate
    ? helpArticleHref(other, article.alternate.slug)
    : `${helpCollectionHref(other, article.collection.slug)}?missing=1`;

  return (
    <>
      <a
        href="#help-article"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-control focus:bg-flovoo-navy focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {dict.nav.skipToContent}
      </a>

      <ViewTracker articleId={article.id} locale={locale} />

      <HelpHeader
        locale={locale}
        alternateHref={alternateHref}
        collections={navigation}
        active={active}
      />

      <JsonLd
        data={techArticleJsonLd({
          locale,
          title: article.title,
          description: article.answerSummary ?? article.metaDescription ?? article.excerpt,
          url: helpArticleHref(locale, article.slug),
          image: helpOgImageUrl(
            locale,
            article.title,
            collectionName,
            article.ogImagePath ? mediaPublicUrl(article.ogImagePath) : null,
          ),
          publishedAt: article.publishedAt,
          updatedAt: article.updatedAt,
          questionTitle: article.questionTitle,
          keyFacts: article.keyFacts,
          sectionName: collectionName,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: dict.help.breadcrumbHome, href: helpHomeHref(locale) },
          { name: collectionName, href: helpCollectionHref(locale, article.collection.slug) },
          { name: article.title, href: helpArticleHref(locale, article.slug) },
        ])}
      />
      {/* The question-style title is itself a Q/A pair: it is the phrasing a
          person actually types, answered by the summary. */}
      {faqPairs(article.body).length > 0 || (article.questionTitle && article.answerSummary) ? (
        <JsonLd
          data={faqPageJsonLd([
            ...(article.questionTitle && article.answerSummary
              ? [{ question: article.questionTitle, answer: article.answerSummary }]
              : []),
            ...faqPairs(article.body),
          ])}
        />
      ) : null}
      {definedTerms(article.body).length > 0 ? (
        <JsonLd data={definedTermJsonLd(definedTerms(article.body), locale)} />
      ) : null}

      <HelpShell locale={locale} collections={navigation} active={active}>
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {/*
            Reading column plus the outline rail. The sidebar takes the inline
            start, so the rail sits at the inline end — left in Arabic, right in
            English — and the article reads between the two. The rail needs the
            widest breakpoint once three columns share the track; below it the
            outline folds into the accordion under the title.
          */}
          <div className="mx-auto w-full max-w-[60rem] xl:grid xl:grid-cols-[minmax(0,1fr)_14rem] xl:gap-12">
            <article id="help-article" className="mx-auto w-full max-w-[42rem] xl:mx-0 xl:ms-auto">
              <Breadcrumbs
                label={dict.help.breadcrumbLabel}
                items={[
                  { label: dict.help.breadcrumbHome, href: helpHomeHref(locale) },
                  {
                    label: collectionName,
                    href: helpCollectionHref(locale, article.collection.slug),
                  },
                  { label: article.title },
                ]}
              />

              <header className="mt-5">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-2xl font-bold leading-tight text-text">{article.title}</h1>
                  <CopyPageMenu
                    articleId={article.id}
                    locale={locale}
                    markdownUrl={`${helpArticleHref(locale, article.slug)}.md`}
                    canonicalUrl={absoluteUrl(helpArticleHref(locale, article.slug))}
                    dict={dict}
                  />
                </div>
                {/* The lead paragraph. Semantically the first <p> after the
                    <h1>, which is the passage a retrieval system reads. */}
                {article.answerSummary || article.excerpt ? (
                  <p className="mt-2 text-base leading-6 text-text-secondary">
                    {article.answerSummary || article.excerpt}
                  </p>
                ) : null}
                <p className="numeric mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-text-tertiary">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" strokeWidth={2} aria-hidden />
                    <time dateTime={article.updatedAt}>
                      {t(dict.help.updatedAt, { date: formatDate(article.updatedAt, locale) })}
                    </time>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-3.5" strokeWidth={2} aria-hidden />
                    {readingTimeLabel(dict, locale, article.readingMinutes)}
                  </span>
                </p>
              </header>

              {article.keyFacts.length > 0 ? (
                <aside className="mt-5 rounded-card border border-border bg-subtle p-4">
                  <h2 className="mb-2 text-sm font-bold text-text">{dict.help.atAGlance}</h2>
                  <ul className="flex list-disc flex-col gap-1.5 ps-5 text-sm text-text-secondary">
                    {article.keyFacts.map((fact, index) => (
                      <li key={index}>{fact}</li>
                    ))}
                  </ul>
                </aside>
              ) : null}

              <div className="mt-5 xl:hidden">
                <TableOfContents
                  entries={article.toc}
                  title={dict.help.tocTitle}
                  variant="inline"
                />
              </div>

              <div className="mt-6">
                <ArticleBody body={article.body} dict={dict} />
              </div>

              <div className="mt-10 flex flex-col gap-6">
                <ArticleFeedback
                  articleId={article.id}
                  locale={locale}
                  labels={helpFeedbackLabels(dict)}
                />
                <PrevNextNav
                  previous={article.previous}
                  next={article.next}
                  hrefFor={(slug) => helpArticleHref(locale, slug)}
                  labels={{ previous: dict.help.previous, next: dict.help.next }}
                />
                <RelatedArticles
                  articles={related}
                  title={dict.help.relatedTitle}
                  hrefFor={(slug) => helpArticleHref(locale, slug)}
                />
                <EscalationCard dict={dict} />
              </div>
            </article>

            <aside className="hidden xl:block">
              <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pb-4">
                <TableOfContents entries={article.toc} title={dict.help.tocTitle} variant="rail" />
              </div>
            </aside>
          </div>
        </main>
      </HelpShell>

      <SiteFooter
        locale={locale}
        updatedAt={article.updatedAt}
        links={helpFooterLinks(locale, siteUrl(), {
          roadmap: dict.help.roadmapLink,
          updates: dict.nav.updates,
        })}
      />
    </>
  );
}
