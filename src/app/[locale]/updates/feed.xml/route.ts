import { NextResponse } from "next/server";

import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getPublishedChangelog } from "@/lib/data/repository";

/**
 * RSS for the changelog. The reference links one from its Updates page, and it
 * is what lets someone follow releases without an account or an inbox.
 */
export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (!isLocale(locale)) return new NextResponse("Not found", { status: 404 });

  const dict = getDictionary(locale);
  const origin = new URL(request.url).origin;
  const entries = await getPublishedChangelog();

  const items = entries
    .filter((entry) => entry.published_at)
    .map((entry) => {
      const title = locale === "ar" ? entry.title_ar : entry.title_en;
      const body = (locale === "ar" ? entry.body_ar : entry.body_en) ?? "";
      // A relative cover path has to be absolute in a feed: readers resolve it
      // against their own origin, not ours.
      const image = entry.image_url
        ? entry.image_url.startsWith("http")
          ? entry.image_url
          : `${origin}${entry.image_url}`
        : null;

      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${origin}/${locale}/updates#${entry.id}</link>
      <guid isPermaLink="false">${entry.id}</guid>
      <pubDate>${new Date(entry.published_at!).toUTCString()}</pubDate>
${image ? `      <enclosure url="${escapeXml(image)}" type="image/svg+xml" />\n` : ""}      <description>${escapeXml(body)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(`${dict.site.name} — ${dict.updates.title}`)}</title>
    <link>${origin}/${locale}/updates</link>
    <description>${escapeXml(dict.updates.metaDescription)}</description>
    <language>${locale}</language>
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
