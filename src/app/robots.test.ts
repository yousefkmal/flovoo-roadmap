import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AI_CRAWLERS, searchClassCrawlers } from "../config/ai-crawlers.ts";

/**
 * The one rule that must never break: a search-class bot is never disallowed
 * from the help center. Blocking one of these is invisible in the UI and costs
 * us every citation that bot's assistant would have made.
 *
 *   npm test
 */

/** The same shape `robots.ts` builds, without importing Next's types. */
const ALWAYS_DISALLOW = [
  "/ar/admin",
  "/en/admin",
  "/api/",
  "/ar/help/search",
  "/en/help/search",
  "/ar/search",
  "/en/search",
];

const HELP_PATHS = ["/ar/help", "/en/help", "/ar/articles/x", "/en/articles/x"];

describe("robots policy", () => {
  it("disallows nothing that would hide a help article", () => {
    for (const path of HELP_PATHS) {
      for (const rule of ALWAYS_DISALLOW) {
        assert.ok(
          !path.startsWith(rule),
          `${rule} would block ${path} — the help center must stay crawlable`,
        );
      }
    }
  });

  it("keeps the admin, the API and search results out of every index", () => {
    for (const blocked of ["/ar/admin", "/en/admin", "/api/", "/ar/help/search"]) {
      assert.ok(ALWAYS_DISALLOW.includes(blocked), `${blocked} must stay disallowed`);
    }
  });

  it("names the crawlers that decide whether an assistant can cite us", () => {
    const tokens = new Set(AI_CRAWLERS.map((c) => c.token));
    for (const required of [
      "Googlebot",
      "Bingbot",
      "OAI-SearchBot",
      "ChatGPT-User",
      "Claude-SearchBot",
      "Claude-User",
      "PerplexityBot",
      "Perplexity-User",
      "Applebot",
    ]) {
      assert.ok(tokens.has(required), `${required} is missing from the crawler config`);
    }
  });

  it("classifies every search-class bot as allowed", () => {
    for (const crawler of searchClassCrawlers()) {
      assert.ok(
        !ALWAYS_DISALLOW.includes("/"),
        `${crawler.token} must not be blocked at the root`,
      );
    }
    assert.ok(searchClassCrawlers().length >= 12, "the search-class list looks too short");
  });

  it("has no duplicate tokens", () => {
    const tokens = AI_CRAWLERS.map((c) => c.token);
    assert.equal(new Set(tokens).size, tokens.length);
  });
});
