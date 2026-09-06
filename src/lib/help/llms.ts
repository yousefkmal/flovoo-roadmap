import "server-only";

import {
  getHelpCollectionsWithCounts,
  getHelpNavigation,
  getPublishedArticlesForExport,
} from "@/lib/data/help-repository";
import { articleToMarkdown } from "@/lib/help/markdown";
import { helpArticleHref, helpCollectionHref, helpHomeHref } from "@/lib/help/paths";
import { absoluteUrl } from "@/lib/help/seo";
import type { Locale } from "@/lib/types";

/**
 * `/llms.txt` and `/llms-full.txt`.
 *
 * An honest note on why these exist: the evidence that AI search crawlers read
 * `llms.txt` is weak, and no major provider has committed to it. We ship it
 * because it costs almost nothing, it is genuinely useful to coding agents and
 * to our own AI Agent, and it is a machine-readable statement of what Flovoo
 * is. We do not expect traffic from it and never justify work by it.
 *
 * Arabic first throughout — that is the whole Phase 7 thesis.
 */

const BRAND_AR = `فلوفو منصة مراسلة تجارية عربية أولًا. تجمع محادثات واتساب وفيسبوك ماسنجر وإنستغرام وتيك توك وودجت الموقع في صندوق وارد واحد للفريق، مع قوالب واتساب والحملات والأتمتة وإدارة جهات الاتصال.`;

const BRAND_EN = `Flovoo is an Arabic-first business messaging platform. It brings WhatsApp, Facebook Messenger, Instagram, TikTok and a website widget into one shared team inbox, with WhatsApp templates, campaigns, automation and contact management.`;

function header(out: string[]) {
  out.push("# Flovoo — مركز المساعدة / Help Center");
  out.push("");
  out.push(`> ${BRAND_AR}`);
  out.push(`> ${BRAND_EN}`);
  out.push("");
  out.push(`Home (AR): ${absoluteUrl(helpHomeHref("ar"))}`);
  out.push(`Home (EN): ${absoluteUrl(helpHomeHref("en"))}`);
  out.push(`Generated: ${new Date().toISOString()}`);
  out.push("");
}

/** The index: topics, then every published article with its Markdown address. */
export async function buildLlmsTxt(): Promise<string> {
  const out: string[] = [];
  header(out);

  for (const locale of ["ar", "en"] as Locale[]) {
    const [collections, navigation] = await Promise.all([
      getHelpCollectionsWithCounts(locale),
      getHelpNavigation(locale),
    ]);
    const articlesByCollection = new Map(navigation.map((c) => [c.id, c.articles]));

    out.push(locale === "ar" ? "## بالعربية" : "## In English");
    out.push("");
    for (const collection of collections) {
      const name = locale === "ar" ? collection.name_ar : collection.name_en;
      const articles = articlesByCollection.get(collection.id) ?? [];
      if (!articles.length) continue;
      out.push(`### ${name}`);
      const description = locale === "ar" ? collection.description_ar : collection.description_en;
      if (description) out.push(`${description}`);
      out.push(`Topic: ${absoluteUrl(helpCollectionHref(locale, collection.slug))}`);
      out.push("");
      for (const article of articles) {
        const url = absoluteUrl(helpArticleHref(locale, article.slug));
        // The `.md` address is the point: it is the clean text, not the page.
        out.push(`- [${article.title}](${url}.md)`);
      }
      out.push("");
    }
  }
  return out.join("\n");
}

/** Every published article's full text, Arabic first. */
export async function buildLlmsFullTxt(): Promise<string> {
  const out: string[] = [];
  header(out);
  out.push("The full text of every published article follows, Arabic first.");
  out.push("");

  for (const locale of ["ar", "en"] as Locale[]) {
    for (const article of await getPublishedArticlesForExport(locale)) {
      out.push("");
      out.push("=".repeat(72));
      out.push("");
      out.push(
        articleToMarkdown({
          title: article.title,
          language: locale,
          canonicalUrl: absoluteUrl(helpArticleHref(locale, article.slug)),
          collection: article.collectionName,
          updatedAt: article.updatedAt,
          excerpt: article.excerpt,
          answerSummary: article.answerSummary,
          keyFacts: article.keyFacts,
          body: article.body,
        }),
      );
    }
  }
  return out.join("\n");
}

export const LLMS_HEADERS = {
  "content-type": "text/plain; charset=utf-8",
  // Regenerated on publish through revalidation, cheap to serve in between.
  "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  "x-robots-tag": "all",
} as const;
