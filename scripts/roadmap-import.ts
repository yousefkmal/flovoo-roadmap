/**
 * Imports the two feature batches from `roadmap-features-import.md`.
 *
 *   npm run roadmap:import            plan only
 *   npm run roadmap:import -- --apply
 *
 * One transaction for everything (rule 7). Nothing already on the board is
 * deleted: the two features that matched are updated in place so their votes,
 * followers and changelog drafts survive (Yousef's decision on rule 4).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import postgres from "postgres";

import { plainToDoc } from "../src/lib/changelog/body.ts";

const root = join(import.meta.dirname, "..");
const APPLY = process.argv.includes("--apply");

/** Yousef's answer to rule 2. Every Batch A item ships on this date. */
const BATCH_A_SHIPPED_AT = "2026-08-30T00:00:00Z";

/** Rule 4, decided: keep the existing row, update its copy, preserve its votes. */
const DUPLICATES: Record<string, { titleEn: string }> = {
  "analytics-reporting-dashboard": { titleEn: "Analysts & Reports feature" },
  "ai-agents": { titleEn: "AI Employees" },
};

/** `type` → `changelog_kind`. There is no "mobile" kind; the category carries that. */
const KIND: Record<string, "new" | "improved" | "fixed"> = {
  feature: "new",
  improvement: "improved",
  mobile: "new",
};

/** Colours for the eleven new categories, from the design system's palette. */
const CATEGORY_COLOUR = [
  "#2EA8FF", "#4D6BFB", "#7A5AF8", "#12B76A", "#F79009",
  "#EF4444", "#06AED4", "#8B5CF6", "#EC4899", "#64748B", "#0EA5E9",
];

interface Item {
  order: number;
  batch: "A" | "B";
  slug: string;
  type?: string;
  status: string;
  category_suggestion: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  review?: string;
}

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

/** The folded YAML scalars arrive with newlines; a description is one paragraph. */
const clean = (value: string) => value.replace(/\s+/g, " ").trim();

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

async function main() {
  const env = loadEnv();
  const items = JSON.parse(readFileSync(join(root, "migration", "roadmap-items.json"), "utf8")) as Item[];

  // Categories, ordered by how many items use them (Yousef's decision on rule 3).
  const usage = new Map<string, number>();
  for (const item of items) {
    usage.set(item.category_suggestion, (usage.get(item.category_suggestion) ?? 0) + 1);
  }
  const categories = [...usage.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([suggestion, count], index) => {
      const [nameEn, nameAr] = suggestion.split("/").map((s) => s.trim());
      return {
        suggestion,
        slug: slugify(nameEn),
        name_en: nameEn,
        name_ar: nameAr,
        color: CATEGORY_COLOUR[index % CATEGORY_COLOUR.length],
        sort_order: index,
        count,
      };
    });

  const batchA = items.filter((i) => i.batch === "A").sort((a, b) => a.order - b.order);
  const batchB = items.filter((i) => i.batch === "B").sort((a, b) => a.order - b.order);
  const duplicates = items.filter((i) => DUPLICATES[i.slug]);
  const fresh = items.filter((i) => !DUPLICATES[i.slug]);

  console.log("PLAN");
  console.log(`  categories to create   ${categories.length}`);
  console.log(`  features to insert     ${fresh.length}`);
  console.log(`  features to update     ${duplicates.length} (kept with their votes)`);
  console.log(`  changelog drafts       ${batchA.filter((i) => !DUPLICATES[i.slug]).length}`);
  console.log(`  batch A shipped_at     ${BATCH_A_SHIPPED_AT}`);
  console.log();
  for (const c of categories) console.log(`   ${String(c.count).padStart(2)}  ${c.slug.padEnd(20)} ${c.name_en} / ${c.name_ar}`);

  if (!APPLY) {
    console.log("\nPlan only. Re-run with --apply.");
    return;
  }

  const sql = postgres(env.SUPABASE_DB_URL!, { ssl: "require", max: 1, connect_timeout: 20 });
  const report: string[] = [];
  try {
    await sql.begin(async (tx) => {
      const before = await tx`select
        (select count(*)::int from features) features,
        (select count(*)::int from categories) categories,
        (select count(*)::int from changelog_entries) changelog,
        (select coalesce(sum(vote_count),0)::int from features) votes`;
      console.log("\nbefore:", before[0]);

      // -- categories -----------------------------------------------------
      const categoryId = new Map<string, string>();
      for (const category of categories) {
        const [row] = await tx`
          insert into categories (slug, name_ar, name_en, color, sort_order)
          values (${category.slug}, ${category.name_ar}, ${category.name_en},
                  ${category.color}, ${category.sort_order})
          returning id`;
        categoryId.set(category.suggestion, row.id as string);
      }
      console.log(`created ${categoryId.size} categories`);

      // -- the two that already exist -------------------------------------
      for (const item of duplicates) {
        const match = DUPLICATES[item.slug];
        const [existing] = await tx`
          select id, vote_count from features where title_en = ${match.titleEn} limit 1`;
        if (!existing) throw new Error(`expected to find "${match.titleEn}" on the board`);
        await tx`
          update features
             set title_ar = ${item.title_ar},
                 title_en = ${item.title_en},
                 description_ar = ${clean(item.description_ar)},
                 description_en = ${clean(item.description_en)},
                 status = ${item.status},
                 category_id = ${categoryId.get(item.category_suggestion)!},
                 sort_order = ${item.order}
           where id = ${existing.id}`;
        report.push(
          `updated in place: "${match.titleEn}" → "${item.title_en}" (votes kept: ${existing.vote_count})`,
        );
      }

      // -- everything else ------------------------------------------------
      let insertedShipped = 0;
      let insertedInProgress = 0;
      let drafts = 0;

      for (const item of fresh) {
        const shippedAt = item.batch === "A" ? BATCH_A_SHIPPED_AT : null;
        const [feature] = await tx`
          insert into features
            (title_ar, title_en, description_ar, description_en, status, category_id,
             sort_order, shipped_at)
          values (${item.title_ar}, ${item.title_en},
                  ${clean(item.description_ar)}, ${clean(item.description_en)},
                  ${item.status}, ${categoryId.get(item.category_suggestion)!},
                  ${item.order}, ${shippedAt})
          returning id`;
        if (item.batch === "A") insertedShipped++;
        else insertedInProgress++;

        // Batch A only (rule 5): a draft entry linked back to the feature, so
        // the entry's category comes from the feature it announces.
        if (item.batch === "A") {
          await tx`
            insert into changelog_entries
              (feature_id, kind, title_ar, title_en, body_ar, body_en, is_published, published_at)
            values (${feature.id}, ${KIND[item.type ?? "feature"]},
                    ${item.title_ar}, ${item.title_en},
                    ${tx.json(plainToDoc(clean(item.description_ar)) as never)},
                    ${tx.json(plainToDoc(clean(item.description_en)) as never)},
                    ${false}, ${null})`;
          drafts++;
        }
      }

      console.log(`inserted ${insertedShipped} shipped, ${insertedInProgress} in progress`);
      console.log(`created ${drafts} changelog drafts, all unpublished`);

      const after = await tx`select
        (select count(*)::int from features) features,
        (select count(*)::int from categories) categories,
        (select count(*)::int from changelog_entries) changelog,
        (select coalesce(sum(vote_count),0)::int from features) votes`;
      console.log("after:", after[0]);
      if (after[0].votes !== before[0].votes) {
        throw new Error(`votes changed: ${before[0].votes} → ${after[0].votes}`);
      }
      report.push(`total votes unchanged: ${after[0].votes}`);
    });
    console.log("\ncommitted.");
    for (const line of report) console.log(`  ${line}`);

    writeFileSync(
      join(root, "migration", "roadmap-import-report.md"),
      ["# تقرير استيراد خارطة الطريق", "", ...report.map((r) => `- ${r}`), ""].join("\n"),
      "utf8",
    );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
