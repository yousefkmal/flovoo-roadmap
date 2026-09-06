import "server-only";

import { BRAND } from "@/config/brand";
import { getServiceSupabase } from "@/lib/data/supabase-admin";
import { domainsIn, judgeAnswer, type Verdict } from "@/lib/help/citations-core";

/**
 * Asking the models whether they cite us.
 *
 * Every other measurement in Phase 7 is a proxy. A crawler hit says a page was
 * readable; only the answer text says whether it was used. That makes this the
 * one honest number — and the most expensive, so the volume stays small.
 *
 * Providers sit behind one interface and none is required. A provider without
 * a key reports "not configured", which is different from zero and is shown
 * differently: zero would say we are never cited, which we would not know.
 */

export type ProviderId = "anthropic" | "openai" | "perplexity" | "google";

export interface CitationResult {
  answerText: string;
  citedDomains: string[];
  error?: string;
}

export interface CitationProvider {
  id: ProviderId;
  label: string;
  isConfigured: boolean;
  ask(prompt: string, language: "ar" | "en"): Promise<CitationResult>;
}

const OURS = [BRAND.url, BRAND.helpUrl, BRAND.roadmapUrl].map(
  (u) => new URL(u).hostname.replace(/^www\./, ""),
);

export function judge(answerText: string): Verdict {
  return judgeAnswer(answerText, OURS);
}

/**
 * Anthropic, with web search enabled — the model has to be able to look
 * something up, or the answer says nothing about whether we are findable.
 */
function anthropicProvider(): CitationProvider {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  return {
    id: "anthropic",
    label: "Claude",
    isConfigured: Boolean(key),
    async ask(prompt) {
      if (!key) return { answerText: "", citedDomains: [], error: "not configured" };
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: process.env.ANTHROPIC_CITATION_MODEL ?? "claude-sonnet-5",
            max_tokens: 1200,
            tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
            messages: [{ role: "user", content: prompt }],
          }),
          signal: AbortSignal.timeout(90000),
        });
        if (!response.ok) {
          return { answerText: "", citedDomains: [], error: `HTTP ${response.status}` };
        }
        const body = (await response.json()) as {
          content?: { type: string; text?: string; citations?: { url?: string }[] }[];
        };
        // Two sources of truth: the prose, and the citation objects the API
        // attaches. A URL can appear in one and not the other.
        const text = (body.content ?? [])
          .filter((block) => block.type === "text")
          .map((block) => block.text ?? "")
          .join("\n");
        const citedUrls = (body.content ?? [])
          .flatMap((block) => block.citations ?? [])
          .map((c) => c.url)
          .filter((u): u is string => Boolean(u));
        return { answerText: [text, ...citedUrls].join("\n"), citedDomains: domainsIn(text) };
      } catch (error) {
        return { answerText: "", citedDomains: [], error: (error as Error).message };
      }
    },
  };
}

/** Not configured yet; the shape is here so adding a key is all it takes. */
function unconfigured(id: ProviderId, label: string, envVar: string): CitationProvider {
  const key = process.env[envVar]?.trim();
  return {
    id,
    label,
    isConfigured: Boolean(key),
    async ask() {
      return { answerText: "", citedDomains: [], error: "not configured" };
    },
  };
}

export function providers(): CitationProvider[] {
  return [
    anthropicProvider(),
    unconfigured("openai", "ChatGPT", "OPENAI_API_KEY"),
    unconfigured("perplexity", "Perplexity", "PERPLEXITY_API_KEY"),
    unconfigured("google", "Gemini", "GOOGLE_AI_API_KEY"),
  ];
}

export interface RunSummary {
  provider: string;
  asked: number;
  cited: number;
  errors: number;
  skipped: boolean;
  /** Prompts left unasked because the invocation ran out of time. */
  remaining: number;
}

export interface RunOptions {
  limit?: number;
  /**
   * How many questions to have in flight at once. A search-enabled answer takes
   * around fifteen seconds, so asking them one at a time does not fit in a
   * serverless invocation: the first real run reached 17 of 30 and was killed
   * at the 300s ceiling.
   */
  concurrency?: number;
  /** Stop starting new questions after this moment, and report what is left. */
  deadline?: number;
  /**
   * A prompt already asked this recently is not asked again, so an invocation
   * that ran out of time resumes where it stopped instead of repeating work
   * that has already been paid for.
   */
  freshnessHours?: number;
}

/** Runs `work` over `items` with at most `concurrency` in flight. */
async function pooled<T>(
  items: T[],
  concurrency: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await work(items[index]);
    }
  });
  await Promise.all(workers);
}

/**
 * One pass over the active prompts. Small on purpose: sixty prompts a week
 * across the configured providers, well inside anyone's terms of use.
 */
export async function runCitationCheck(options: RunOptions = {}): Promise<RunSummary[]> {
  const {
    limit = 60,
    concurrency = 5,
    deadline = Date.now() + 240_000,
    freshnessHours = 20,
  } = options;

  const supabase = getServiceSupabase();
  if (!supabase) return [];

  const { data: prompts } = await supabase
    .from("help_geo_prompts")
    .select("id, prompt, language")
    .eq("is_active", true)
    .limit(limit);

  const rows = (prompts ?? []) as { id: string; prompt: string; language: "ar" | "en" }[];
  const since = new Date(Date.now() - freshnessHours * 3600_000).toISOString();
  const summaries: RunSummary[] = [];

  for (const provider of providers()) {
    if (!provider.isConfigured) {
      summaries.push({
        provider: provider.id,
        asked: 0,
        cited: 0,
        errors: 0,
        skipped: true,
        remaining: 0,
      });
      continue;
    }

    const { data: recent } = await supabase
      .from("help_geo_runs")
      .select("prompt_id")
      .eq("provider", provider.id)
      .gte("ts", since);
    const done = new Set((recent ?? []).map((r) => (r as { prompt_id: string }).prompt_id));
    const todo = rows.filter((row) => !done.has(row.id));

    let asked = 0;
    let cited = 0;
    let errors = 0;
    let ranOutOfTime = 0;

    await pooled(todo, concurrency, async (prompt) => {
      if (Date.now() > deadline) {
        ranOutOfTime++;
        return;
      }
      const result = await provider.ask(prompt.prompt, prompt.language);
      asked++;
      if (result.error) errors++;
      const verdict = judge(result.answerText);
      if (verdict.flovooCited) cited++;

      await supabase.from("help_geo_runs").insert({
        provider: provider.id,
        prompt_id: prompt.id,
        language: prompt.language,
        answer_text: result.answerText.slice(0, 20000) || null,
        cited_domains: verdict.citedDomains,
        flovoo_cited: verdict.flovooCited,
        flovoo_urls: verdict.flovooUrls,
        position: verdict.position,
        competitor_domains: verdict.competitorDomains,
        error: result.error ?? null,
      });
    });

    summaries.push({
      provider: provider.id,
      asked,
      cited,
      errors,
      skipped: false,
      remaining: ranOutOfTime,
    });
  }
  return summaries;
}
