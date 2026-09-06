import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Phase 7 exists to make these articles findable. A `noindex` reintroduced by
 * accident would undo the whole phase without breaking a single page or
 * failing any other test, so its absence is pinned here.
 *
 * Read as source text rather than imported: `seo.ts` uses the `@/` alias,
 * which plain Node does not resolve.
 *
 *   npm test
 */

const source = readFileSync(new URL("./seo.ts", import.meta.url), "utf8");

describe("help indexing", () => {
  it("exports robots metadata that is always undefined", () => {
    assert.match(
      source,
      /export const helpRobots: undefined = undefined;/,
      "help pages must carry no robots metadata at all",
    );
  });

  it("never sets index: false", () => {
    assert.ok(!/index:\s*false/.test(source), "seo.ts must never set index: false");
    assert.ok(!/noindex/i.test(source.replace(/\/\*[\s\S]*?\*\//g, "")), "no noindex outside comments");
  });

  it("has no environment switch that could close indexing again", () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.ok(
      !code.includes("HELP_INDEXABLE"),
      "the launch gate was removed in Phase 7A; re-adding it needs a deliberate decision",
    );
  });
});
