/**
 * The pre-import checks for `roadmap-features-import.md`: duplicates against
 * everything already on the board, and whether each suggested category exists.
 *
 *   npm run roadmap:check
 *
 * Reads only. Rules 3 and 4 of the brief say to stop and report rather than
 * create categories or overwrite a matching feature, so this writes nothing.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import postgres from "postgres";

const root = join(import.meta.dirname, "..");

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
  duplicate_watch?: string;
}

/**
 * Titles are compared on their meaningful words, not character by character:
 * "Analytics & Reporting Dashboard" and "Analysts & Reports feature" are the
 * same thing to a reader and share no exact string.
 */
const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with", "your",
  "feature", "features", "new", "dashboard", "page", "section",
  "في", "من", "على", "إلى", "الى", "و", "أو", "ال", "مع", "عن", "التي", "الذي",
]);

function tokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[ً-ْٰـ]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .map((w) => w.replace(/^(ال|وال|بال)/, ""))
      .filter((w) => w.length > 1 && !STOP.has(w)),
  );
}

/** Jaccard overlap of the meaningful words in two titles. */
function similarity(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / new Set([...x, ...y]).size;
}

async function main() {
  const env = loadEnv();
  const items = JSON.parse(
    readFileSync(join(root, "migration", "roadmap-items.json"), "utf8"),
  ) as Item[];

  const sql = postgres(env.SUPABASE_DB_URL!, { ssl: "require", max: 1, connect_timeout: 20 });
  try {
    const categories = await sql`select id, slug, name_ar, name_en from categories`;
    const features = await sql`
      select f.id, f.status, f.vote_count, f.title_ar, f.title_en, f.category_id,
             (select count(*)::int from feature_subscriptions s where s.feature_id = f.id) followers,
             (select count(*)::int from changelog_entries e where e.feature_id = f.id) changelog,
             (select count(*)::int from submissions sb where sb.created_feature = f.id) from_submission
        from features f`;

    const lines: string[] = [];
    const add = (line = "") => lines.push(line);

    add("# فحص ما قبل استيراد خارطة الطريق");
    add();
    add(`33 عنصرًا في الملف: 19 مُطلقة و14 قيد التنفيذ. لم أُدخل شيئًا.`);
    add();

    // -- categories ---------------------------------------------------------
    add("## التصنيفات");
    add();
    const suggestions = [...new Set(items.map((i) => i.category_suggestion))].sort();
    if (categories.length === 0) {
      add(`**جدول التصنيفات فارغ تمامًا — لا يوجد ولا تصنيف واحد في قاعدة البيانات.**`);
      add();
      add(`لذلك الاقتراحات الإحدى عشرة كلها بلا مقابل. القاعدة الثالثة تمنعني من إنشائها من تلقاء نفسي، فهذه هي القائمة كما اقترحها الملف:`);
      add();
      add("| التصنيف المقترح | الاسم الإنجليزي | الاسم العربي | كم عنصرًا يستعمله |");
      add("| --- | --- | --- | --- |");
      for (const suggestion of suggestions) {
        const [en, ar] = suggestion.split("/").map((s) => s.trim());
        const count = items.filter((i) => i.category_suggestion === suggestion).length;
        add(`| ${suggestion} | ${en} | ${ar} | ${count} |`);
      }
      add();
      add("لا يوجد عمود ترتيب أو لون في الملف. لو وافقت، أنشئها بهذا الترتيب وبألوان من نظام التصميم.");
    } else {
      add("| التصنيف المقترح | الحالة |");
      add("| --- | --- |");
      for (const suggestion of suggestions) {
        const [en, ar] = suggestion.split("/").map((s) => s.trim());
        const match = categories.find(
          (c) =>
            String(c.name_en).toLowerCase() === en.toLowerCase() ||
            String(c.name_ar) === ar,
        );
        add(`| ${suggestion} | ${match ? `موجود (${match.slug})` : "**مفقود**"} |`);
      }
    }
    add();

    // -- duplicates ---------------------------------------------------------
    add("## فحص التكرار");
    add();
    add(`قارنتُ الـ33 عنصرًا كلها بكل ميزة موجودة في أي حالة. الموجود حاليًا ${features.length} ميزة.`);
    add();

    interface Match {
      item: Item;
      feature: (typeof features)[number];
      score: number;
    }
    const matches: Match[] = [];
    for (const item of items) {
      for (const feature of features) {
        const score = Math.max(
          similarity(item.title_en, String(feature.title_en)),
          similarity(item.title_ar, String(feature.title_ar)),
        );
        if (score >= 0.25) matches.push({ item, feature, score });
      }
    }
    matches.sort((a, b) => b.score - a.score);

    if (!matches.length) add("لا تكرار.");
    for (const m of matches) {
      add(`### ${m.item.slug}`);
      add();
      add(`| | في الملف | الموجود على اللوحة |`);
      add("| --- | --- | --- |");
      add(`| بالإنجليزية | ${m.item.title_en} | ${m.feature.title_en} |`);
      add(`| بالعربية | ${m.item.title_ar} | ${m.feature.title_ar} |`);
      add(`| الحالة | ${m.item.status} | ${m.feature.status} |`);
      add(`| الأصوات | — | **${m.feature.vote_count}** |`);
      add(`| المتابعون | — | ${m.feature.followers} |`);
      add(`| مسودات «الجديد» المرتبطة | — | ${m.feature.changelog} |`);
      add(`| جاء من اقتراح عميل | — | ${m.feature.from_submission ? "نعم" : "لا"} |`);
      add(`| تشابه العنوان | ${Math.round(m.score * 100)}% | |`);
      add();
      add(
        m.item.duplicate_watch
          ? `الملف نفسه توقّع هذا التطابق.`
          : `**الملف لم يتوقّع هذا التطابق — وجدتُه بالفحص.**`,
      );
      add();
    }

    writeFileSync(join(root, "migration", "roadmap-check.md"), lines.join("\n"), "utf8");
    console.log(lines.join("\n"));
    console.log(`\nwrote ${join(root, "migration", "roadmap-check.md")}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
