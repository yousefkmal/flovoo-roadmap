import { BRAND } from "@/config/brand";
import type { Metadata } from "next";

import type { Dictionary } from "@/i18n";
import { toPlainText, type BlockDocument, type BlockNode } from "@/lib/help/blocks";
import { helpHomeHref, helpSearchHref } from "@/lib/help/paths";
import { siteUrl } from "@/lib/site";
import type { Locale } from "@/lib/types";

/**
 * Structured data and social metadata for the help center (brief §8).
 *
 * Everything here produces plain objects. JSON-LD is emitted by `<JsonLd>`
 * as a script tag; Open Graph and Twitter fields go through Next's Metadata
 * API so they merge with the locale layout's defaults.
 */

/**
 * The help center is indexed.
 *
 * There used to be a launch gate here (`NEXT_PUBLIC_HELP_INDEXABLE`) that put
 * `noindex` on every page while the content rode on the roadmap's domain. That
 * is done: `help.flovoo.com` is live and the articles are published, so the
 * gate is removed rather than left as a switch nobody remembers. Phase 7 is
 * about being found; a stray `noindex` would silently undo all of it, so
 * `npm test` fails if this ever returns anything but `undefined`.
 */
export const helpRobots: undefined = undefined;

/**
 * One organisation node, one id, referenced everywhere.
 *
 * The `@id` is what lets a consumer merge the author of an article, the
 * publisher of the site and the subject of the about page into a single
 * entity instead of three lookalikes. Emitted in full once per page; every
 * other mention is a reference to this id.
 */
export const ORGANIZATION_ID = `${BRAND.url}/#organization`;

const ORGANIZATION_REF = { "@id": ORGANIZATION_ID } as const;

export function organizationJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: BRAND.name,
    alternateName: BRAND.nameAr,
    legalName: BRAND.legalName,
    url: BRAND.url,
    logo: { "@type": "ImageObject", url: BRAND.logo },
    sameAs: [...BRAND.sameAs, BRAND.helpUrl, BRAND.roadmapUrl],
    areaServed: BRAND.areaServed.map((code) => ({ "@type": "Country", identifier: code })),
    inLanguage: locale,
    description:
      locale === "ar"
        ? "منصة مراسلة تجارية عربية أولًا تجمع واتساب وفيسبوك ماسنجر وإنستغرام وتيك توك وودجت الموقع في صندوق وارد واحد للفريق."
        : "An Arabic-first business messaging platform bringing WhatsApp, Facebook Messenger, Instagram, TikTok and a website widget into one shared team inbox.",
  };
}

/** Kept for the nodes that only need to point at the organisation. */
const ORGANIZATION = ORGANIZATION_REF;

/** Resolves a possibly relative href against the deployment's own address. */
export function absoluteUrl(href: string): string {
  return /^https?:\/\//i.test(href) ? href : new URL(href, siteUrl()).toString();
}

/** The generated share card for a title, or the uploaded one when there is one. */
export function helpOgImageUrl(
  locale: Locale,
  title: string,
  kicker: string,
  uploaded: string | null,
): string {
  if (uploaded) return absoluteUrl(uploaded);
  const params = new URLSearchParams({ locale, title, kicker });
  return absoluteUrl(`/api/og/help?${params.toString()}`);
}

export function helpSocialMetadata(input: {
  locale: Locale;
  title: string;
  description: string;
  url: string;
  image: string;
  type?: "website" | "article";
  publishedTime?: string | null;
  modifiedTime?: string | null;
  siteName: string;
}): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      title: input.title,
      description: input.description,
      url: absoluteUrl(input.url),
      siteName: input.siteName,
      locale: input.locale === "ar" ? "ar_EG" : "en_US",
      type: input.type ?? "website",
      images: [{ url: input.image, width: 1200, height: 630, alt: input.title }],
      ...(input.type === "article"
        ? {
            publishedTime: input.publishedTime ?? undefined,
            modifiedTime: input.modifiedTime ?? undefined,
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [input.image],
    },
  };
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

export interface Crumb {
  name: string;
  href: string;
}

export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.href),
    })),
  };
}

export function techArticleJsonLd(input: {
  locale: Locale;
  title: string;
  description: string | null;
  url: string;
  image: string;
  publishedAt: string | null;
  updatedAt: string;
  sectionName: string;
  /** The title as a user would ask it (Phase 7B), when one was written. */
  questionTitle?: string | null;
  /** Short facts most likely to be quoted: limits, prices, prerequisites. */
  keyFacts?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: input.title,
    description: input.description ?? undefined,
    inLanguage: input.locale,
    url: absoluteUrl(input.url),
    mainEntityOfPage: absoluteUrl(input.url),
    image: [input.image],
    datePublished: input.publishedAt ?? undefined,
    dateModified: input.updatedAt,
    articleSection: input.sectionName,
    // The question a user would actually type, offered alongside the headline
    // so a match on the question is a match on the article.
    alternativeHeadline: input.questionTitle ?? undefined,
    // Limits, prices, prerequisites — the parts most likely to be quoted.
    ...(input.keyFacts?.length
      ? {
          about: {
            "@type": "ItemList",
            itemListElement: input.keyFacts.map((fact, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: fact,
            })),
          },
        }
      : {}),
    author: ORGANIZATION,
    publisher: ORGANIZATION,
  };
}

/**
 * Every Definition block, as `DefinedTerm`.
 *
 * "What is a WABA?" is one of the commonest shapes of question put to an
 * assistant, and Arabic technical glossaries are thin — a clear one is
 * disproportionately likely to be the source that gets quoted.
 */
export function definedTerms(body: BlockDocument): { term: string; description: string }[] {
  const terms: { term: string; description: string }[] = [];
  const walk = (node: BlockNode) => {
    if (node.type === "definition") {
      const term = String(node.attrs?.term ?? "").trim();
      const description = toPlainText({ type: "doc", content: node.content ?? [] }).trim();
      if (term && description) terms.push({ term, description });
    }
    node.content?.forEach(walk);
  };
  walk(body);
  return terms;
}

export function definedTermJsonLd(
  terms: { term: string; description: string }[],
  locale: Locale,
) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    inLanguage: locale,
    hasDefinedTerm: terms.map((t) => ({
      "@type": "DefinedTerm",
      name: t.term,
      description: t.description,
      inDefinedTermSet: { "@type": "DefinedTermSet", name: "Flovoo" },
    })),
  };
}

/** Every FAQ block in a body, flattened to question/answer pairs. */
export function faqPairs(body: BlockDocument): { question: string; answer: string }[] {
  const pairs: { question: string; answer: string }[] = [];
  const walk = (node: BlockNode) => {
    if (node.type === "faqItem") {
      const question = String(node.attrs?.question ?? "").trim();
      const answer = toPlainText({ type: "doc", content: node.content ?? [] }).trim();
      if (question && answer) pairs.push({ question, answer });
    }
    node.content?.forEach(walk);
  };
  walk(body);
  return pairs;
}

export function faqPageJsonLd(pairs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map((pair) => ({
      "@type": "Question",
      name: pair.question,
      acceptedAnswer: { "@type": "Answer", text: pair.answer },
    })),
  };
}

export function websiteJsonLd(locale: Locale, dict: Dictionary) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: dict.help.name,
    url: absoluteUrl(helpHomeHref(locale)),
    inLanguage: locale,
    publisher: ORGANIZATION,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl(helpSearchHref(locale))}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}
