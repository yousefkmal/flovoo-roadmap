import { NextResponse } from "next/server";

import { isLocale } from "@/i18n/config";
import { getHelpArticleBySlug } from "@/lib/data/help-repository";
import { articleToMarkdown } from "@/lib/help/markdown";
import { decodeSlug, helpArticleHref } from "@/lib/help/paths";
import { absoluteUrl } from "@/lib/help/seo";

/**
 * An article as Markdown, served at `<article-url>.md`.
 *
 * `proxy.ts` rewrites the public `.md` address here so the URL a person copies
 * is the article's own address with `.md` on the end — the shape agents and
 * docs tooling expect. Content negotiation (`Accept: text/markdown`) lands
 * here too.
 *
 * Only published articles: this is the same content the page serves, in a
 * different costume, so it must not become a way to read drafts.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; slug: string }> },
) {
  const { locale, slug: rawSlug } = await params;
  if (!isLocale(locale)) return new NextResponse("Not found", { status: 404 });

  const slug = decodeSlug(rawSlug).replace(/\.md$/i, "");
  const article = await getHelpArticleBySlug(locale, slug);
  if (!article) return new NextResponse("Not found", { status: 404 });

  const markdown = articleToMarkdown({
    title: article.title,
    language: locale,
    canonicalUrl: absoluteUrl(helpArticleHref(locale, article.slug)),
    collection: locale === "ar" ? article.collection.name_ar : article.collection.name_en,
    updatedAt: article.updatedAt,
    excerpt: article.excerpt,
    body: article.body,
  });

  return new NextResponse(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      // The freshness signals Phase 7A asks for, on the endpoint that can
      // actually carry them: a static page cannot set per-request headers.
      "last-modified": new Date(article.updatedAt).toUTCString(),
      etag: `"${Buffer.from(`${article.slug}:${article.updatedAt}`).toString("base64url")}"`,
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
      "x-robots-tag": "all",
    },
  });
}
