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
 * Whether search engines may index the help center.
 *
 * Default **off**. The help center rides on the roadmap's domain until
 * `help.flovoo.com` is pointed at this app, and the content is still filling
 * in; an index full of `news.flovoo.com/ar/help/...` costs more to undo than
 * to prevent. Set `NEXT_PUBLIC_HELP_INDEXABLE=true` only when the host is
 * live and the content is ready (recorded in CLAUDE.md).
 */
export const isHelpIndexable = process.env.NEXT_PUBLIC_HELP_INDEXABLE === "true";

/** The `robots` metadata every help page carries while indexing is closed. */
export const helpRobots = isHelpIndexable
  ? undefined
  : ({ index: false, follow: false } as const);

const ORGANIZATION = {
  "@type": "Organization",
  name: "Flovoo",
  url: "https://flovoo.com",
} as const;

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
    author: ORGANIZATION,
    publisher: ORGANIZATION,
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
