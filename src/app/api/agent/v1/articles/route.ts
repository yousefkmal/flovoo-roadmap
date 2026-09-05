import { NextResponse, type NextRequest } from "next/server";

import { isLocale } from "@/i18n/config";
import {
  getHelpArticleBySlug,
  getHelpArticleSlugs,
  getHelpCollections,
} from "@/lib/data/help-repository";
import { toPlainText } from "@/lib/help/blocks";
import { helpArticleHref } from "@/lib/help/paths";
import { absoluteUrl } from "@/lib/help/seo";
import { requireAgentKey } from "@/lib/help/agent-auth";
import type { Locale } from "@/lib/types";

/**
 * The AI Agent's read contract, v1 (brief §7).
 *
 *   GET /api/agent/v1/articles?locale=ar&limit=50&offset=0
 *
 * Published articles only, one object per language version, with the plain
 * text the agent reasons over and the public URL it cites. The shape is
 * stable: fields may be added, never removed or renamed. Breaking changes get
 * a `/v2`. Documented in the README.
 */
export const dynamic = "force-dynamic";

export const AGENT_CONTRACT_VERSION = "1.0.0";

const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const denied = requireAgentKey(request);
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const rawLocale = params.get("locale");
  if (rawLocale && !isLocale(rawLocale)) {
    return NextResponse.json({ error: "locale must be 'ar' or 'en'" }, { status: 400 });
  }
  const locales: Locale[] = rawLocale && isLocale(rawLocale) ? [rawLocale] : ["ar", "en"];
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get("limit")) || 50));
  const offset = Math.max(0, Number(params.get("offset")) || 0);

  const collections = await getHelpCollections();
  const collectionById = new Map(collections.map((c) => [c.id, c]));

  const all: {
    id: string;
    language: Locale;
    slug: string;
    title: string;
    excerpt: string | null;
    body_markdown: string;
    url: string;
    collection: { slug: string; name: string };
    published_at: string | null;
    updated_at: string;
  }[] = [];

  for (const locale of locales) {
    for (const slug of await getHelpArticleSlugs(locale)) {
      const article = await getHelpArticleBySlug(locale, slug);
      if (!article) continue;
      const collection = collectionById.get(article.collection.id);
      all.push({
        id: article.id,
        language: locale,
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        // Plain text derived from the same blocks the page renders, so the
        // agent never sees markup it has to strip.
        body_markdown: toPlainText(article.body),
        url: absoluteUrl(helpArticleHref(locale, article.slug)),
        collection: {
          slug: article.collection.slug,
          name: collection
            ? locale === "ar"
              ? collection.name_ar
              : collection.name_en
            : article.collection.slug,
        },
        published_at: article.publishedAt,
        updated_at: article.updatedAt,
      });
    }
  }

  all.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const page = all.slice(offset, offset + limit);

  return NextResponse.json(
    {
      version: AGENT_CONTRACT_VERSION,
      total: all.length,
      limit,
      offset,
      next_offset: offset + limit < all.length ? offset + limit : null,
      articles: page,
    },
    { headers: { "cache-control": "public, max-age=60, s-maxage=300" } },
  );
}
