/**
 * Every AI system we care about, in one list.
 *
 * `robots.ts`, the crawler log's classifier, the access check and the docs all
 * read from here, so a bot is added or reclassified in exactly one place.
 *
 * Lives under `src/config/` rather than a repository-root `config/` (as the
 * Phase 7 brief writes it) so the `@/` alias resolves it like everything else.
 *
 * Two classes, and the difference matters:
 *
 *   search   a crawler building an index an assistant retrieves from, or an
 *            agent fetching a page because a person just asked about it.
 *            Blocking these makes us invisible; they are never disallowed.
 *   training a crawler collecting text to train a model. Allowed here by
 *            Yousef's decision (§10.1): a help center exists to be known.
 *
 * `user` is a subset of search worth naming: the fetch happened because a real
 * person asked a question this second. Phase 7D treats those as live retrievals.
 */

export type CrawlerPurpose = "search" | "training" | "user";

export interface AiCrawler {
  /** The token as it appears in `User-Agent`, and in robots.txt. */
  token: string;
  operator: string;
  purpose: CrawlerPurpose;
  /** Where the operator publishes the addresses it crawls from, when it does. */
  verificationUrl?: string;
  /** Reverse-DNS suffix that a genuine request resolves to, when published. */
  reverseDnsSuffix?: string;
  note?: string;
}

export const AI_CRAWLERS: AiCrawler[] = [
  // ── OpenAI ────────────────────────────────────────────────────────────
  {
    token: "OAI-SearchBot",
    operator: "OpenAI",
    purpose: "search",
    verificationUrl: "https://openai.com/searchbot.json",
    note: "Builds the index ChatGPT Search answers from.",
  },
  {
    token: "ChatGPT-User",
    operator: "OpenAI",
    purpose: "user",
    verificationUrl: "https://openai.com/chatgpt-user.json",
    note: "A person asked ChatGPT about this page just now.",
  },
  {
    token: "GPTBot",
    operator: "OpenAI",
    purpose: "training",
    verificationUrl: "https://openai.com/gptbot.json",
  },

  // ── Anthropic ─────────────────────────────────────────────────────────
  { token: "Claude-SearchBot", operator: "Anthropic", purpose: "search" },
  {
    token: "Claude-User",
    operator: "Anthropic",
    purpose: "user",
    note: "A person asked Claude about this page just now.",
  },
  { token: "ClaudeBot", operator: "Anthropic", purpose: "training" },
  { token: "anthropic-ai", operator: "Anthropic", purpose: "training" },

  // ── Perplexity ────────────────────────────────────────────────────────
  {
    token: "PerplexityBot",
    operator: "Perplexity",
    purpose: "search",
    verificationUrl: "https://www.perplexity.com/perplexitybot.json",
  },
  {
    token: "Perplexity-User",
    operator: "Perplexity",
    purpose: "user",
    verificationUrl: "https://www.perplexity.com/perplexity-user.json",
  },

  // ── Google ────────────────────────────────────────────────────────────
  {
    token: "Googlebot",
    operator: "Google",
    purpose: "search",
    reverseDnsSuffix: ".googlebot.com",
    note: "AI Overviews and Gemini grounding both lean on the Google index.",
  },
  {
    token: "Google-Extended",
    operator: "Google",
    purpose: "training",
    note: "Controls Gemini training only; it is not a separate crawler.",
  },

  // ── Microsoft ─────────────────────────────────────────────────────────
  {
    token: "Bingbot",
    operator: "Microsoft",
    purpose: "search",
    reverseDnsSuffix: ".search.msn.com",
    note: "Copilot and ChatGPT Search both draw on Bing.",
  },

  // ── Everyone else ─────────────────────────────────────────────────────
  { token: "Applebot", operator: "Apple", purpose: "search", reverseDnsSuffix: ".applebot.apple.com" },
  { token: "DuckAssistBot", operator: "DuckDuckGo", purpose: "search" },
  { token: "Amazonbot", operator: "Amazon", purpose: "search" },
  { token: "Meta-ExternalAgent", operator: "Meta", purpose: "search" },
  { token: "Meta-ExternalFetcher", operator: "Meta", purpose: "user" },
  { token: "YouBot", operator: "You.com", purpose: "search" },
  { token: "MistralAI-User", operator: "Mistral", purpose: "user" },
  { token: "CCBot", operator: "Common Crawl", purpose: "training" },
  { token: "Bytespider", operator: "ByteDance", purpose: "training" },
  { token: "cohere-ai", operator: "Cohere", purpose: "training" },
];

/** Never disallow these: blocking one makes us invisible to that assistant. */
export const SEARCH_CLASS = new Set<CrawlerPurpose>(["search", "user"]);

export const searchClassCrawlers = () => AI_CRAWLERS.filter((c) => SEARCH_CLASS.has(c.purpose));
export const trainingCrawlers = () => AI_CRAWLERS.filter((c) => c.purpose === "training");

/** The user agent that matches this string, if any. Longest token wins. */
export function classifyUserAgent(userAgent: string | null | undefined): AiCrawler | null {
  if (!userAgent) return null;
  const haystack = userAgent.toLowerCase();
  let best: AiCrawler | null = null;
  for (const crawler of AI_CRAWLERS) {
    if (!haystack.includes(crawler.token.toLowerCase())) continue;
    // "ClaudeBot" also contains "Claude"; prefer the most specific token so
    // Claude-SearchBot is never logged as ClaudeBot.
    if (!best || crawler.token.length > best.token.length) best = crawler;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Where AI-referred visitors come from (Phase 7D reads this)
// ---------------------------------------------------------------------------

/** Referrer hostname → the label we store. Suffix match, so subdomains count. */
export const AI_REFERRERS: { host: string; label: string }[] = [
  { host: "chatgpt.com", label: "chatgpt" },
  { host: "chat.openai.com", label: "chatgpt" },
  { host: "claude.ai", label: "claude" },
  { host: "perplexity.ai", label: "perplexity" },
  { host: "gemini.google.com", label: "gemini" },
  { host: "copilot.microsoft.com", label: "copilot" },
  { host: "bing.com", label: "copilot" },
  { host: "you.com", label: "you" },
  { host: "duckduckgo.com", label: "duckduckgo" },
  { host: "x.ai", label: "grok" },
  { host: "grok.com", label: "grok" },
  { host: "chat.deepseek.com", label: "deepseek" },
  { host: "poe.com", label: "poe" },
  { host: "mistral.ai", label: "mistral" },
];

export function aiSourceFromReferrer(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const entry of AI_REFERRERS) {
    if (host === entry.host || host.endsWith(`.${entry.host}`)) return entry.label;
  }
  return null;
}

// ---------------------------------------------------------------------------
// "Ask an assistant about this page" — the Copy page menu (7A item 9)
// ---------------------------------------------------------------------------

export interface AssistantTarget {
  /** Stable id: also the key the click counter stores. */
  id: "chatgpt" | "claude" | "perplexity";
  label: string;
  /** `{prompt}` is replaced with the URL-encoded prompt. */
  urlTemplate: string;
}

/** These query parameters change occasionally; this is the one place to fix them. */
export const ASSISTANT_TARGETS: AssistantTarget[] = [
  { id: "chatgpt", label: "ChatGPT", urlTemplate: "https://chatgpt.com/?q={prompt}" },
  { id: "claude", label: "Claude", urlTemplate: "https://claude.ai/new?q={prompt}" },
  { id: "perplexity", label: "Perplexity", urlTemplate: "https://www.perplexity.ai/search?q={prompt}" },
];

/** The prompt follows the page's language, because the answer should too. */
export function assistantPrompt(locale: "ar" | "en", url: string): string {
  return locale === "ar"
    ? `اقرأ هذه المقالة من مركز مساعدة فلوفو وجاوب على أسئلتي عنها: ${url}`
    : `Read this Flovoo Help Center article and answer my questions about it: ${url}`;
}

export function assistantUrl(target: AssistantTarget, locale: "ar" | "en", url: string): string {
  return target.urlTemplate.replace("{prompt}", encodeURIComponent(assistantPrompt(locale, url)));
}
