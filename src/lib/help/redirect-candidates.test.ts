import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { redirectCandidates } from "./redirect-candidates.ts";

/**
 * These decide whether a link somebody saved years ago still lands somewhere.
 * The Intercom migration wrote redirect rows with decoded Arabic paths and
 * id-only fallbacks; the app asks with percent-encoded paths. Both spellings
 * have to meet.
 *
 *   npm test
 */

describe("redirectCandidates", () => {
  it("offers the path with and without a locale prefix", () => {
    const candidates = redirectCandidates("ar", "/ar/articles/connect-whatsapp");
    assert.ok(candidates.includes("/ar/articles/connect-whatsapp"));
    assert.ok(candidates.includes("/articles/connect-whatsapp"));
  });

  it("offers the decoded spelling of an encoded Arabic slug", () => {
    const encoded = "/ar/articles/%D8%B1%D8%A8%D8%B7-%D9%88%D8%A7%D8%AA%D8%B3%D8%A7%D8%A8";
    const candidates = redirectCandidates("ar", encoded);
    assert.ok(candidates.includes(encoded), "the exact request is still tried");
    assert.ok(candidates.includes("/ar/articles/ربط-واتساب"), "and its decoded form");
  });

  it("falls back to the Intercom id when the slug has since been reworded", () => {
    const candidates = redirectCandidates("en", "/en/articles/16536857-a-title-nobody-uses-now");
    assert.ok(candidates.includes("/en/articles/16536857"));
    assert.ok(candidates.includes("/articles/16536857"));
  });

  it("puts the exact address before the id-only fallback", () => {
    const candidates = redirectCandidates("en", "/en/articles/16536857-how-to-add-an-account");
    const exact = candidates.indexOf("/en/articles/16536857-how-to-add-an-account");
    const byId = candidates.indexOf("/en/articles/16536857");
    assert.ok(exact !== -1 && byId !== -1);
    assert.ok(exact < byId, "an address that matches exactly must win");
  });

  it("keeps the requested locale rather than the one in the old path", () => {
    // A reader on the Arabic site opening an English-shaped old link should be
    // offered the Arabic row first.
    const candidates = redirectCandidates("ar", "/en/articles/16536857-something");
    assert.equal(candidates[0], "/ar/articles/16536857-something");
  });

  it("leaves a slug that only looks encoded alone", () => {
    const candidates = redirectCandidates("en", "/en/articles/100%-uptime");
    assert.ok(candidates.includes("/en/articles/100%-uptime"));
  });

  it("does not offer a bare slash", () => {
    for (const candidate of redirectCandidates("ar", "/ar")) {
      assert.notEqual(candidate, "/");
      assert.ok(candidate.length > 1);
    }
  });

  it("only treats a leading run of digits as an id", () => {
    const candidates = redirectCandidates("en", "/en/articles/whatsapp-2024-pricing");
    assert.ok(!candidates.some((c) => c === "/en/articles/whatsapp"));
  });
});
