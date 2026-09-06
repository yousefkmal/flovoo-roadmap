import "server-only";

import { createHash } from "node:crypto";

import { classifyUserAgent } from "@/config/ai-crawlers";
import { getServiceSupabase } from "@/lib/data/supabase-admin";
import type { Locale } from "@/lib/types";

/**
 * Recording that an AI system fetched a page.
 *
 * Two honesty rules run through this file.
 *
 * A user agent is a string anyone can send, so a match is a *claim*. It is
 * stored either way — an unverified hit is still information — but flagged, and
 * the dashboard shows the split rather than adding them together.
 *
 * Retrieval is not citation. A crawler fetching an article proves the article
 * was readable, nothing more. `ChatGPT-User` and its siblings are the closest
 * we get: those fetches happen because a person asked about the page a second
 * ago, so they are surfaced separately as live retrievals.
 */

/** Reverse DNS, the method the big operators publish. Cached per address. */
const verdicts = new Map<string, { verified: boolean; at: number }>();
const VERDICT_TTL = 60 * 60 * 1000;

async function verifyByReverseDns(ip: string, suffix: string): Promise<boolean> {
  const cached = verdicts.get(`${ip}:${suffix}`);
  if (cached && Date.now() - cached.at < VERDICT_TTL) return cached.verified;

  let verified = false;
  try {
    const dns = await import("node:dns/promises");
    const names = await dns.reverse(ip);
    // Forward-confirmed: the name must point back at the same address, or a
    // spoofed PTR record would be enough to pass.
    for (const name of names) {
      if (!name.endsWith(suffix)) continue;
      const forward = await dns.resolve(name).catch(() => [] as string[]);
      if (forward.includes(ip)) {
        verified = true;
        break;
      }
    }
  } catch {
    verified = false;
  }
  verdicts.set(`${ip}:${suffix}`, { verified, at: Date.now() });
  return verified;
}

/** Addresses are never stored — only a hash, so a hit cannot be traced back. */
function hashIp(ip: string): string {
  const salt = process.env.ANALYTICS_SALT ?? "flovoo-help";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export interface CrawlerHit {
  userAgent: string | null;
  ip: string | null;
  path: string;
  status: number;
  articleId: string | null;
  language: Locale | null;
}

/**
 * Logs the hit when the request came from a crawler we know. Never throws:
 * a page must not fail because analytics did.
 */
export async function noteCrawlerHit(hit: CrawlerHit): Promise<void> {
  const crawler = classifyUserAgent(hit.userAgent);
  if (!crawler) return;

  const supabase = getServiceSupabase();
  if (!supabase) return;

  const ip = hit.ip ?? "";
  const verified = ip && crawler.reverseDnsSuffix
    ? await verifyByReverseDns(ip, crawler.reverseDnsSuffix)
    : false;

  try {
    const { error } = await supabase.rpc("help_note_crawler_hit", {
      p_bot_token: crawler.token,
      p_operator: crawler.operator,
      p_purpose: crawler.purpose,
      p_path: hit.path.slice(0, 500),
      p_article: hit.articleId,
      p_language: hit.language,
      p_status: hit.status,
      p_verified: verified,
      p_ip_hash: ip ? hashIp(ip) : "unknown",
    });
    if (error) console.warn(`crawler log: ${error.message}`);
  } catch (error) {
    console.warn("crawler log failed", error);
  }
}
