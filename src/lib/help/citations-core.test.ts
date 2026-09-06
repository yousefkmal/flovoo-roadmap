import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { domainsIn, judgeAnswer } from "./citations-core.ts";

/**
 * This decides whether we record "Flovoo was cited". A false positive would
 * make the whole phase look like it is working when it is not, which is worse
 * than no measurement at all.
 *
 *   npm test
 */

const OURS = ["flovoo.com", "help.flovoo.com", "news.flovoo.com"];

describe("finding domains in an answer", () => {
  it("reads them out of links", () => {
    const found = domainsIn("See https://help.flovoo.com/ar/articles/x and https://twilio.com/docs");
    assert.ok(found.includes("help.flovoo.com"));
    assert.ok(found.includes("twilio.com"));
  });

  it("reads bare domains too, which models often write", () => {
    assert.ok(domainsIn("According to help.flovoo.com and wati.io").includes("help.flovoo.com"));
  });

  it("drops the www so one site is one domain", () => {
    assert.deepEqual(domainsIn("https://www.flovoo.com/x"), ["flovoo.com"]);
  });

  it("finds nothing in an answer with no sources", () => {
    assert.deepEqual(domainsIn("WhatsApp Business has a daily messaging limit."), []);
  });
});

describe("judging whether we were cited", () => {
  it("records a citation and where it appeared", () => {
    const verdict = judgeAnswer(
      "First see https://wati.io/guide then https://help.flovoo.com/ar/articles/x",
      OURS,
    );
    assert.equal(verdict.flovooCited, true);
    assert.equal(verdict.position, 2, "we were the second source named");
    assert.deepEqual(verdict.competitorDomains, ["wati.io"]);
    assert.equal(verdict.flovooUrls.length, 1);
  });

  it("counts a subdomain of ours as ours", () => {
    assert.equal(judgeAnswer("https://help.flovoo.com/x", OURS).flovooCited, true);
  });

  it("does not mistake a lookalike domain for ours", () => {
    const verdict = judgeAnswer("https://flovoo.com.evil.net/x and https://notflovoo.com", OURS);
    assert.equal(verdict.flovooCited, false, "a suffix trick must not count as a citation");
  });

  it("reports not cited rather than guessing when no source is named", () => {
    const verdict = judgeAnswer("Flovoo is a messaging platform.", OURS);
    assert.equal(verdict.flovooCited, false);
    assert.equal(verdict.position, null);
  });

  it("names the competitors, which is the content roadmap", () => {
    const verdict = judgeAnswer("https://wati.io https://respond.io https://twilio.com", OURS);
    assert.deepEqual(verdict.competitorDomains.sort(), ["respond.io", "twilio.com", "wati.io"]);
  });
});
