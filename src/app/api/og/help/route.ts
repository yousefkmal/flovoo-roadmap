import { join } from "node:path";

import { Resvg } from "@resvg/resvg-js";
import { NextResponse, type NextRequest } from "next/server";

import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import type { Locale } from "@/lib/types";

/**
 * The branded share card: the article title over the Flovoo gradient, with
 * the topic as a kicker and the wordmark. Rendered as SVG and rasterised with
 * resvg, which shapes Arabic and applies bidi correctly — the reason this is
 * not an `ImageResponse`: Satori reverses Arabic word order (see the README
 * on the roadmap's own cards, which are pre-rendered for the same reason).
 *
 * Text is wrapped by an estimated glyph width; titles are short and the card
 * has room for three lines, so an estimate is enough.
 */

const WIDTH = 1200;
const HEIGHT = 630;
const MAX_LINES = 3;
const TITLE_SIZE = 60;
const LINE_HEIGHT = 1.35;

const fontDir = join(process.cwd(), "src", "lib", "og", "fonts");
const FONT_FILES = [
  "noto-sans-arabic-400.ttf",
  "noto-sans-arabic-700.ttf",
  "plus-jakarta-sans-600.ttf",
  "plus-jakarta-sans-800.ttf",
];

const fontFiles = FONT_FILES.map((file) => join(fontDir, file));

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Arabic glyphs are narrower on average than Latin at the same size. */
function estimateWidth(text: string, size: number): number {
  let width = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) width += 0.28 * size;
    else if (/[؀-ۿ]/.test(ch)) width += 0.5 * size;
    else if (/[A-Z]/.test(ch)) width += 0.68 * size;
    else width += 0.56 * size;
  }
  return width;
}

function wrap(text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateWidth(candidate, size) <= maxWidth || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > MAX_LINES) {
    const kept = lines.slice(0, MAX_LINES);
    kept[MAX_LINES - 1] = `${kept[MAX_LINES - 1].replace(/[\s.,،]+$/, "")}…`;
    return kept;
  }
  return lines;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawLocale = params.get("locale");
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "ar";
  const dict = getDictionary(locale);
  const title = (params.get("title") ?? dict.help.name).trim().slice(0, 160);
  const kicker = (params.get("kicker") ?? dict.help.badge).trim().slice(0, 60);
  const rtl = locale === "ar";

  const family = rtl ? "Noto Sans Arabic" : "Plus Jakarta Sans";
  const margin = 88;
  const maxWidth = WIDTH - margin * 2;
  const lines = wrap(title, TITLE_SIZE, maxWidth);
  const lineHeight = TITLE_SIZE * LINE_HEIGHT;
  const blockHeight = lines.length * lineHeight;
  const firstBaseline = (HEIGHT - blockHeight) / 2 + TITLE_SIZE * 0.9 + 24;
  const x = rtl ? WIDTH - margin : margin;
  const anchor = rtl ? "end" : "start";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2EA8FF"/>
      <stop offset="50%" stop-color="#4D6BFB"/>
      <stop offset="100%" stop-color="#7A5AF8"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <circle cx="${rtl ? 140 : WIDTH - 140}" cy="90" r="260" fill="#ffffff" opacity="0.08"/>
  <circle cx="${rtl ? WIDTH - 120 : 120}" cy="${HEIGHT - 60}" r="200" fill="#0B2659" opacity="0.14"/>
  <text x="${x}" y="${margin + 30}" font-family="${family}" font-weight="${rtl ? 700 : 600}" font-size="26" fill="#ffffff" fill-opacity="0.9" text-anchor="${anchor}" direction="${rtl ? "rtl" : "ltr"}">${escapeXml(kicker)}</text>
  ${lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${firstBaseline + index * lineHeight}" font-family="${family}" font-weight="${rtl ? 700 : 800}" font-size="${TITLE_SIZE}" fill="#ffffff" text-anchor="${anchor}" direction="${rtl ? "rtl" : "ltr"}">${escapeXml(line)}</text>`,
    )
    .join("\n  ")}
  <text x="${x}" y="${HEIGHT - margin + 10}" font-family="Plus Jakarta Sans" font-weight="800" font-size="34" fill="#ffffff" text-anchor="${anchor}" direction="ltr">Flovoo</text>
  <text x="${rtl ? margin : WIDTH - margin}" y="${HEIGHT - margin + 10}" font-family="${family}" font-weight="${rtl ? 400 : 600}" font-size="24" fill="#ffffff" fill-opacity="0.85" text-anchor="${rtl ? "start" : "end"}" direction="${rtl ? "rtl" : "ltr"}">${escapeXml(dict.help.name)}</text>
</svg>`;

  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: family },
  })
    .render()
    .asPng();

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      // Titles change rarely; scrapers may cache for a day, the CDN for a week.
      "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}
