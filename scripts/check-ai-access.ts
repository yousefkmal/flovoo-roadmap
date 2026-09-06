/**
 * Can every AI system we allow actually read a help article?
 *
 *   npm run check:ai-access                    against the live help host
 *   BASE_URL=http://localhost:3000 npm run check:ai-access
 *
 * robots.txt saying "allow" is a request, not a guarantee: a CDN, a WAF or a
 * bot-protection rule can still challenge a crawler, and the failure is
 * invisible from a browser. This fetches a real article as each allowed bot
 * and insists on 200 with the article's own text in the body — a challenge
 * page returns 200 too.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { AI_CRAWLERS, searchClassCrawlers } from "../src/config/ai-crawlers.ts";

const root = join(import.meta.dirname, "..");

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    /* not required */
  }
  return env;
}

const env = loadEnv();
const base = (process.env.BASE_URL ?? env.NEXT_PUBLIC_HELP_URL ?? "https://help.flovoo.com").replace(/\/$/, "");

/** A real browser string, as the control: if this fails, the site is down. */
const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

interface Sample {
  label: string;
  url: string;
  /** A string the real page contains and a challenge page would not. */
  expect: string;
}

async function fetchAs(url: string, userAgent: string) {
  const response = await fetch(url, {
    headers: { "user-agent": userAgent, accept: "text/html,*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
  return { status: response.status, body: await response.text() };
}

async function main() {
  console.log(`checking ${base}\n`);

  // Pick a real published article in each language from the sitemap, so the
  // check keeps working as content changes.
  const samples: Sample[] = [];
  for (const language of ["ar", "en"] as const) {
    // Generous: prerendered in production, recomputed per request in dev.
    const sitemap = await fetch(`${base}/sitemap/${language}.xml`, {
      headers: { "user-agent": BROWSER },
      signal: AbortSignal.timeout(90000),
    });
    if (!sitemap.ok) {
      console.error(`FAILED: sitemap/${language}.xml returned ${sitemap.status}`);
      process.exitCode = 1;
      return;
    }
    const xml = await sitemap.text();
    const article = [...xml.matchAll(/<loc>([^<]*\/articles\/[^<]*)<\/loc>/g)][0]?.[1];
    if (!article) {
      console.error(`FAILED: no article URL in the ${language} sitemap`);
      process.exitCode = 1;
      return;
    }
    samples.push({ label: language, url: article, expect: "<h1" });
  }

  // The control first: a failure here is the site, not the bot policy.
  for (const sample of samples) {
    const control = await fetchAs(sample.url, BROWSER);
    if (control.status !== 200 || !control.body.includes(sample.expect)) {
      console.error(`FAILED: a browser cannot read the ${sample.label} sample (${control.status})`);
      process.exitCode = 1;
      return;
    }
  }
  console.log("control: a browser reads both samples\n");

  let failures = 0;
  for (const crawler of AI_CRAWLERS) {
    const results: string[] = [];
    let bad = false;
    for (const sample of samples) {
      const { status, body } = await fetchAs(sample.url, `${crawler.token}/1.0`);
      const full = body.includes(sample.expect) && body.length > 2000;
      if (status !== 200 || !full) bad = true;
      results.push(`${sample.label}:${status}${full ? "" : " thin"}`);
    }
    const critical = searchClassCrawlers().some((c) => c.token === crawler.token);
    if (bad) {
      failures += critical ? 1 : 0;
      console.log(`${critical ? "FAIL" : "warn"}  ${crawler.token.padEnd(22)} ${results.join("  ")}`);
    } else {
      console.log(`ok    ${crawler.token.padEnd(22)} ${results.join("  ")}`);
    }
  }

  // The markdown twin matters as much as the page for an agent.
  for (const sample of samples) {
    const { status, body } = await fetchAs(`${sample.url}.md`, "ChatGPT-User/1.0");
    const ok = status === 200 && body.startsWith("---");
    console.log(`${ok ? "ok   " : "FAIL "} ${`${sample.label}.md`.padEnd(22)} ${status}`);
    if (!ok) failures++;
  }

  for (const path of ["/llms.txt", "/llms-full.txt", "/robots.txt"]) {
    const { status, body } = await fetchAs(`${base}${path}`, "ChatGPT-User/1.0");
    const ok = status === 200 && body.length > 100;
    console.log(`${ok ? "ok   " : "FAIL "} ${path.padEnd(22)} ${status}`);
    if (!ok) failures++;
  }

  console.log(
    failures === 0
      ? "\nEvery search-class bot reads the full article."
      : `\n${failures} search-class failure(s) — an assistant cannot read us.`,
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
