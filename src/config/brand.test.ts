import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { BRAND, BRAND_VARIANTS, PRODUCT_NAMES } from "./brand.ts";

/**
 * One entity, named one way.
 *
 * AI systems weigh entity consistency: the same product referred to three
 * ways reads as three weaker entities instead of one strong one. A variant
 * that slips into shipped copy is invisible in review and costs exactly the
 * authority this phase is trying to build.
 *
 *   npm test
 */

const root = fileURLToPath(new URL("../..", import.meta.url));

function filesUnder(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      out.push(...filesUnder(full, extensions));
    } else if (extensions.some((e) => entry.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

describe("brand naming", () => {
  it("keeps every variant out of the shipped copy", () => {
    const dictionaries = filesUnder(join(root, "src/i18n/dictionaries"), [".ts"]);
    assert.ok(dictionaries.length >= 2, "expected the ar and en dictionaries");

    for (const file of dictionaries) {
      const source = readFileSync(file, "utf8");
      for (const variant of BRAND_VARIANTS) {
        // Whole words only: "Flovo" is a substring of the correct "Flovoo",
        // and a plain `includes` would fail on every correct use.
        const pattern = new RegExp(
          `(?<![\\p{L}\\p{N}])${variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`,
          "u",
        );
        assert.ok(
          !pattern.test(source),
          `"${variant}" appears in ${file.split("/").pop()} — use "${BRAND.name}" / "${BRAND.nameAr}"`,
        );
      }
    }
  });

  it("names the product features exactly once each", () => {
    const englishNames = Object.values(PRODUCT_NAMES).map((n) => n.en);
    assert.equal(new Set(englishNames).size, englishNames.length);
    const arabicNames = Object.values(PRODUCT_NAMES).map((n) => n.ar);
    assert.equal(new Set(arabicNames).size, arabicNames.length);
  });

  it("uses the official Arabic name for AI Agents", () => {
    // Three spellings were in use: the help center topic imported from Intercom
    // said "الوكلاء الذكيون", the roadmap import said "وكلاء الذكاء الاصطناعي".
    // The user settled it on 2026-09-06; this constant is now what decides, and
    // the help topic and the roadmap feature were renamed to match.
    assert.equal(PRODUCT_NAMES.aiAgents.ar, "وكلاء الذكاء الصناعي");
  });

  it("has a resolvable brand identity for the Organization node", () => {
    for (const url of [BRAND.url, BRAND.helpUrl, BRAND.roadmapUrl, BRAND.logo]) {
      assert.match(url, /^https:\/\//, `${url} must be absolute and https`);
    }
    assert.ok(BRAND.sameAs.length > 0, "sameAs is what links the profiles to the entity");
  });
});
