import "server-only";

import { getServiceSupabase } from "@/lib/data/supabase-admin";
import { helpArticleHref, helpCollectionHref, helpHomeHref } from "@/lib/help/paths";
import { absoluteUrl } from "@/lib/help/seo";
import type { Locale } from "@/lib/types";

/**
 * IndexNow: tell Bing a URL changed instead of waiting to be crawled.
 *
 * This matters more than it looks. Copilot answers from Bing, and ChatGPT
 * Search leans on it too, so how fast Bing sees an edit is how fast two major
 * assistants can cite the new version.
 *
 * Optional by design, like embeddings: with no `INDEXNOW_KEY` set, nothing is
 * sent and nothing fails. A publish must never break because a search engine
 * was unreachable — so every failure here is caught, logged and swallowed.
 */

const ENDPOINT = "https://api.indexnow.org/indexnow";

export const indexNowKey = process.env.INDEXNOW_KEY?.trim() || null;
export const isIndexNowConfigured = Boolean(indexNowKey);

async function record(urls: string[], statusCode: number | null, ok: boolean, error?: string) {
  const supabase = getServiceSupabase();
  if (!supabase) return;
  const { error: insertError } = await supabase.from("help_indexnow_pings").insert({
    urls,
    status_code: statusCode,
    ok,
    error: error ?? null,
  });
  if (insertError) console.warn(`indexnow: could not log the ping: ${insertError.message}`);
}

/**
 * Submits URLs. Never throws.
 *
 * IndexNow caps a submission at 10,000 URLs and expects them all on one host,
 * which is always true here.
 */
export async function pingIndexNow(urls: string[]): Promise<void> {
  const unique = [...new Set(urls.filter(Boolean))];
  if (!unique.length || !indexNowKey) return;

  let host: string;
  try {
    host = new URL(unique[0]).host;
  } catch {
    return;
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: indexNowKey,
        keyLocation: absoluteUrl(`/${indexNowKey}.txt`),
        urlList: unique.slice(0, 10000),
      }),
      signal: AbortSignal.timeout(10000),
    });
    // 200 and 202 both mean accepted; 4xx means our key or host is wrong.
    await record(unique, response.status, response.ok);
  } catch (error) {
    await record(unique, null, false, (error as Error).message);
  }
}

/** Every public address an article edit affects, in both languages. */
export function articleUrls(
  translations: { language: Locale; slug: string }[],
  collectionSlug: string | null,
): string[] {
  const urls: string[] = [];
  for (const translation of translations) {
    urls.push(absoluteUrl(helpArticleHref(translation.language, translation.slug)));
    // The Markdown twin is a separate address; an agent may hold that one.
    urls.push(`${absoluteUrl(helpArticleHref(translation.language, translation.slug))}.md`);
    urls.push(absoluteUrl(helpHomeHref(translation.language)));
    if (collectionSlug) {
      urls.push(absoluteUrl(helpCollectionHref(translation.language, collectionSlug)));
    }
  }
  urls.push(absoluteUrl("/llms.txt"), absoluteUrl("/llms-full.txt"));
  return urls;
}
