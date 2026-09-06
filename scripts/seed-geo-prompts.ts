/**
 * Seeds the citation question set from what customers actually asked.
 *
 *   npm run geo:seed-prompts            plan only
 *   npm run geo:seed-prompts -- --apply
 *
 * Three sources, in order of how much they are worth:
 *   zero-result searches   somebody looked for this and found nothing
 *   unhelpful feedback     somebody read an article and it did not answer them
 *   the team's list        the questions we know get asked
 *
 * The first two are real customer language, which is the whole point: the
 * question a person types into an assistant is much closer to a search box
 * than to an article title.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import postgres from "postgres";

const root = join(import.meta.dirname, "..");
const APPLY = process.argv.includes("--apply");

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

/**
 * The questions the team knows get asked, written the way a person types them
 * into a chat rather than the way an article is titled.
 */
const TEAM_PROMPTS: { prompt: string; language: "ar" | "en" }[] = [
  { language: "ar", prompt: "كيف أربط رقم واتساب بيزنس بمنصة إدارة محادثات؟" },
  { language: "ar", prompt: "ما الفرق بين واتساب بيزنس API والتعايش المشترك Coexistence؟" },
  { language: "ar", prompt: "كم تكلفة رسائل واتساب بيزنس للشركات؟" },
  { language: "ar", prompt: "ما هي حدود المراسلة اليومية في واتساب بيزنس؟" },
  { language: "ar", prompt: "كيف أنشئ قالب رسالة واتساب معتمد؟" },
  { language: "ar", prompt: "لماذا رُفض قالب واتساب الخاص بي؟" },
  { language: "ar", prompt: "ما هي نافذة الـ24 ساعة في واتساب بيزنس؟" },
  { language: "ar", prompt: "أفضل منصة عربية لإدارة محادثات واتساب للفرق" },
  { language: "ar", prompt: "كيف أستورد جهات الاتصال من ملف Excel إلى منصة محادثات؟" },
  { language: "ar", prompt: "كيف أوزّع محادثات واتساب على أعضاء الفريق تلقائيًا؟" },
  { language: "ar", prompt: "كيف أربط صفحة فيسبوك وإنستغرام بصندوق وارد موحّد؟" },
  { language: "ar", prompt: "ما هو حساب واتساب للأعمال WABA وكيف أنشئه؟" },
  { language: "ar", prompt: "كيف أرسل حملة واتساب لعدد كبير من العملاء؟" },
  { language: "ar", prompt: "كيف أزامن سجل محادثات واتساب القديمة؟" },
  { language: "ar", prompt: "ما معنى درجة جودة الرقم في واتساب بيزنس؟" },
  { language: "en", prompt: "How do I connect a WhatsApp Business number to a shared team inbox?" },
  { language: "en", prompt: "What is the difference between WhatsApp Business API and Coexistence?" },
  { language: "en", prompt: "How much do WhatsApp Business messages cost?" },
  { language: "en", prompt: "What are WhatsApp Business daily messaging limits?" },
  { language: "en", prompt: "How do I create an approved WhatsApp message template?" },
  { language: "en", prompt: "Why was my WhatsApp template rejected?" },
  { language: "en", prompt: "What is the 24-hour customer service window on WhatsApp?" },
  { language: "en", prompt: "Best Arabic-first WhatsApp inbox for support teams" },
  { language: "en", prompt: "How do I import contacts from a CSV into a messaging platform?" },
  { language: "en", prompt: "How do I route WhatsApp conversations to team members automatically?" },
  { language: "en", prompt: "How do I connect Facebook and Instagram to one shared inbox?" },
  { language: "en", prompt: "What is a WhatsApp Business Account (WABA) and how do I create one?" },
  { language: "en", prompt: "How do I send a WhatsApp campaign to many customers?" },
  { language: "en", prompt: "How do I sync WhatsApp chat history when connecting a number?" },
  { language: "en", prompt: "What does WhatsApp phone number quality rating mean?" },
];

async function main() {
  const env = loadEnv();
  const sql = postgres(env.SUPABASE_DB_URL!, { ssl: "require", max: 1, connect_timeout: 20 });
  try {
    // What people searched for and found nothing.
    const zeroResults = await sql`
      select query, language, count(*)::int n
        from help_search_queries
       where results_count = 0
       group by query, language
       having count(*) >= 1
       order by count(*) desc
       limit 20`;

    // Articles people said did not help them: the question behind the visit.
    const unhelpful = await sql`
      select t.title, f.language, count(*)::int n
        from help_article_feedback f
        join help_article_translations t
          on t.article_id = f.article_id and t.language = f.language
       where not f.is_helpful
       group by t.title, f.language
       order by count(*) desc
       limit 15`;

    const existing = new Set(
      (await sql`select prompt from help_geo_prompts`).map((r) => String(r.prompt)),
    );

    const candidates = [
      ...TEAM_PROMPTS.map((p) => ({ ...p, source: "team" as const })),
      ...zeroResults.map((r) => ({
        prompt: String(r.query),
        language: r.language as "ar" | "en",
        source: "zero_result" as const,
      })),
      ...unhelpful.map((r) => ({
        prompt: String(r.title),
        language: r.language as "ar" | "en",
        source: "feedback" as const,
      })),
    ].filter((c) => c.prompt.trim().length >= 8 && !existing.has(c.prompt));

    console.log(`candidates: ${candidates.length}`);
    console.log(`  from the team's list: ${candidates.filter((c) => c.source === "team").length}`);
    console.log(`  from zero-result searches: ${candidates.filter((c) => c.source === "zero_result").length}`);
    console.log(`  from unhelpful feedback: ${candidates.filter((c) => c.source === "feedback").length}`);
    console.log(`already present: ${existing.size}`);

    if (!APPLY) {
      console.log("\nPlan only. Re-run with --apply.");
      return;
    }

    await sql.begin(async (tx) => {
      for (const candidate of candidates) {
        await tx`
          insert into help_geo_prompts (prompt, language, source)
          values (${candidate.prompt}, ${candidate.language}, ${candidate.source})`;
      }
    });
    const total = await sql`select count(*)::int n from help_geo_prompts where is_active`;
    console.log(`\ncommitted. active questions: ${total[0].n}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
