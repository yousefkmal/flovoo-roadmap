// Relative, with the extension: `npm run seed:sql` runs this file through Node
// directly, which knows nothing about the `@/` alias for a value import.
import { deriveArticleMeta, type BlockDocument, type BlockNode } from "../help/blocks.ts";
import type {
  HelpArticle,
  HelpArticleTranslation,
  HelpCollection,
} from "@/lib/help/types";
import type { Locale } from "@/lib/types";

/**
 * Seed content for the help center. Mirrors the `help_*` tables in
 * `supabase/seed.sql`, which is generated from this file — keep them in sync
 * with `npm run seed:sql`.
 *
 * The copy is simplified Modern Standard Arabic: warm, verbs first, no
 * dialect, English product terms in parentheses at first mention. Slugs are
 * verbatim Arabic on the Arabic side and plain English on the English side.
 *
 * Screenshots are placeholders drawn as SVGs under `public/help/`. Real
 * captures replace them through the media library in Phase 3.
 */

const now = new Date("2026-09-02T09:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

// ---------------------------------------------------------------------------
// Block builders — keep the content below readable
// ---------------------------------------------------------------------------

type Inline = string | BlockNode;

function inline(parts: Inline | Inline[]): BlockNode[] {
  return (Array.isArray(parts) ? parts : [parts]).map((part) =>
    typeof part === "string" ? { type: "text", text: part } : part,
  );
}

const b = (text: string): BlockNode => ({ type: "text", text, marks: [{ type: "bold" }] });
const code = (text: string): BlockNode => ({ type: "text", text, marks: [{ type: "code" }] });
/** An ID, number or address that must keep its own direction inside Arabic. */
const ltr = (text: string): BlockNode => ({ type: "text", text, marks: [{ type: "ltr" }] });
const link = (text: string, href: string): BlockNode => ({
  type: "text",
  text,
  marks: [{ type: "link", attrs: { href } }],
});

const p = (...parts: Inline[]): BlockNode => ({ type: "paragraph", content: inline(parts) });
const h2 = (text: string): BlockNode => ({
  type: "heading",
  attrs: { level: 2 },
  content: inline(text),
});
const h3 = (text: string): BlockNode => ({
  type: "heading",
  attrs: { level: 3 },
  content: inline(text),
});
const ul = (...items: Inline[][]): BlockNode => ({
  type: "bulletList",
  content: items.map((item) => ({ type: "listItem", content: [p(...item)] })),
});
const steps = (...items: Inline[][]): BlockNode => ({
  type: "steps",
  content: items.map((item) => ({ type: "step", content: [p(...item)] })),
});
const callout = (variant: "info" | "warning" | "tip", ...parts: Inline[]): BlockNode => ({
  type: "callout",
  attrs: { variant },
  content: [p(...parts)],
});
const figure = (src: string, alt: string, caption?: string): BlockNode => ({
  type: "figure",
  attrs: { src, alt, caption: caption ?? null, width: 1200, height: 720 },
});
const table = (header: string[], ...rows: Inline[][]): BlockNode => ({
  type: "table",
  content: [
    {
      type: "tableRow",
      content: header.map((cell) => ({ type: "tableHeader", content: [p(cell)] })),
    },
    ...rows.map((row) => ({
      type: "tableRow",
      content: row.map((cell) => ({ type: "tableCell", content: [p(cell)] })),
    })),
  ],
});
const faq = (...items: [question: string, ...answer: Inline[]][]): BlockNode => ({
  type: "faq",
  content: items.map(([question, ...answer]) => ({
    type: "faqItem",
    attrs: { question },
    content: [p(...answer)],
  })),
});

const doc = (...content: BlockNode[]): BlockDocument => ({ type: "doc", content });

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

const collectionId = (n: number) => `d1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const HELP_COLLECTIONS: HelpCollection[] = [
  {
    id: collectionId(1),
    slug: "getting-started",
    name_ar: "ابدأ من هنا",
    name_en: "Get started",
    description_ar: "أنشئ حسابك، وجهّز مساحة العمل، وأضف فريقك في دقائق.",
    description_en: "Create your account, set up your workspace and add your team in minutes.",
    icon: "rocket",
    sort_order: 1,
    is_published: true,
    created_at: daysAgo(90),
    updated_at: daysAgo(90),
  },
  {
    id: collectionId(2),
    slug: "whatsapp",
    name_ar: "واتساب",
    name_en: "WhatsApp",
    description_ar: "اربط رقمك، واعتمد القوالب، وحلّ مشكلات التوصيل.",
    description_en: "Connect your number, get templates approved and fix delivery issues.",
    icon: "message-circle",
    sort_order: 2,
    is_published: true,
    created_at: daysAgo(90),
    updated_at: daysAgo(90),
  },
  {
    id: collectionId(3),
    slug: "inbox",
    name_ar: "صندوق الوارد",
    name_en: "Inbox",
    description_ar: "وزّع المحادثات، ورُدّ أسرع، ونظّم عمل الفريق اليومي.",
    description_en: "Route conversations, reply faster and organise the team's day.",
    icon: "inbox",
    sort_order: 3,
    is_published: true,
    created_at: daysAgo(90),
    updated_at: daysAgo(90),
  },
  {
    id: collectionId(4),
    slug: "automation",
    name_ar: "الأتمتة",
    name_en: "Automation",
    description_ar: "ردود آلية، وقواعد توجيه، ووكيل ذكاء اصطناعي يعمل بدلًا عنك.",
    description_en: "Auto-replies, routing rules and an AI agent that works on your behalf.",
    icon: "workflow",
    sort_order: 4,
    is_published: true,
    created_at: daysAgo(90),
    updated_at: daysAgo(90),
  },
  {
    id: collectionId(5),
    slug: "campaigns",
    name_ar: "الحملات",
    name_en: "Campaigns",
    description_ar: "أرسل رسائل جماعية على واتساب وتابع نتائجها.",
    description_en: "Send WhatsApp broadcasts and follow their results.",
    icon: "megaphone",
    sort_order: 5,
    is_published: true,
    created_at: daysAgo(90),
    updated_at: daysAgo(90),
  },
  {
    id: collectionId(6),
    slug: "billing",
    name_ar: "الفوترة والاشتراك",
    name_en: "Billing and subscription",
    description_ar: "الخطط، والفواتير، وطرق الدفع، وتغيير الاشتراك.",
    description_en: "Plans, invoices, payment methods and changing your subscription.",
    icon: "credit-card",
    sort_order: 6,
    is_published: true,
    created_at: daysAgo(90),
    updated_at: daysAgo(90),
  },
];

const [GETTING_STARTED, WHATSAPP, INBOX, AUTOMATION, CAMPAIGNS, BILLING] = HELP_COLLECTIONS.map(
  (c) => c.id,
);

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

interface SeedTranslation {
  slug: string;
  title: string;
  excerpt: string;
  body: BlockDocument;
  meta_description?: string;
}

interface SeedArticle {
  n: number;
  collection_id: string;
  status: HelpArticle["status"];
  is_pinned?: boolean;
  sort_order: number;
  section?: { ar: string; en: string };
  /** Lucide name from `HELP_ICONS`; the document glyph when omitted. */
  icon?: string;
  created_days_ago: number;
  updated_days_ago: number;
  ar: SeedTranslation;
  /** Optional on purpose: one seed article is Arabic-only to exercise the notice. */
  en?: SeedTranslation;
}

const SEED_ARTICLES: SeedArticle[] = [
  // ── Get started ───────────────────────────────────────────────────────────
  {
    n: 1,
    collection_id: GETTING_STARTED,
    status: "published",
    is_pinned: true,
    sort_order: 1,
    section: { ar: "الحساب", en: "Your account" },
    icon: "circle-user",
    created_days_ago: 80,
    updated_days_ago: 6,
    ar: {
      slug: "إنشاء-حساب-وإعداد-مساحة-العمل",
      title: "إنشاء حساب فلوفو وإعداد مساحة العمل",
      excerpt: "من التسجيل إلى أول محادثة: الخطوات الأساسية لتجهيز حسابك في أقل من عشر دقائق.",
      body: doc(
        p(
          "مساحة العمل (Workspace) هي المكان الذي تجتمع فيه قنواتك وفريقك ومحادثاتك. تحتاج إلى إعدادها مرة واحدة فقط، ثم يمكن لأي عضو في الفريق الانضمام إليها.",
        ),
        h2("إنشاء الحساب"),
        steps(
          ["افتح ", link("app.flovoo.com", "https://app.flovoo.com"), " واختر ", b("إنشاء حساب"), "."],
          ["أدخل بريدك الإلكتروني للعمل، ثم افتح رسالة التأكيد واضغط على الرابط."],
          ["اختر اسمًا لمساحة العمل. غالبًا يكون اسم شركتك أو متجرك."],
          ["حدّد الدولة والمنطقة الزمنية، فهي تتحكم في مواعيد التقارير وساعات العمل."],
        ),
        figure(
          "/help/workspace-setup.svg",
          "شاشة إعداد مساحة العمل تعرض حقول الاسم والدولة والمنطقة الزمنية.",
          "خطوة إعداد مساحة العمل بعد تأكيد البريد الإلكتروني.",
        ),
        h2("ربط القناة الأولى"),
        p(
          "بعد إنشاء المساحة سيطلب منك فلوفو ربط قناة واحدة على الأقل. نوصي بالبدء بواتساب لأنه القناة الأكثر استخدامًا لدى عملائك، ويمكنك إضافة إنستغرام وماسنجر لاحقًا من صفحة القنوات.",
        ),
        callout(
          "tip",
          "يمكنك تخطي ربط القناة الآن والعودة إليها من ",
          b("الإعدادات ← القنوات"),
          " في أي وقت. بقية الإعدادات لا تعتمد عليها.",
        ),
        h2("إعداد ساعات العمل"),
        p(
          "ساعات العمل تحدد متى يُرسل الرد الآلي خارج الدوام ومتى تُحسب مدة الرد في التقارير. من ",
          b("الإعدادات ← ساعات العمل"),
          " اختر أيام الدوام وساعاته، ويمكنك إضافة أكثر من فترة في اليوم نفسه.",
        ),
        h3("ماذا بعد؟"),
        ul(
          ["ادعُ فريقك وحدّد أدوارهم من مقالة «دعوة فريقك وتحديد الأدوار»."],
          ["أنشئ أول رد آلي لترحّب بالعملاء خارج ساعات العمل."],
          ["استورد جهات الاتصال من ملف CSV إن كانت لديك قائمة عملاء جاهزة."],
        ),
      ),
    },
    en: {
      slug: "create-account-and-set-up-workspace",
      title: "Create your Flovoo account and set up your workspace",
      excerpt: "From sign-up to your first conversation: the essential steps to get your account ready in under ten minutes.",
      body: doc(
        p(
          "Your workspace is where your channels, your team and your conversations come together. You set it up once, and anyone on the team can join it afterwards.",
        ),
        h2("Create the account"),
        steps(
          ["Open ", link("app.flovoo.com", "https://app.flovoo.com"), " and choose ", b("Create account"), "."],
          ["Enter your work email, then open the confirmation email and follow the link."],
          ["Pick a name for the workspace. Usually that is your company or shop name."],
          ["Set the country and time zone. They drive report schedules and business hours."],
        ),
        figure(
          "/help/workspace-setup.svg",
          "The workspace setup screen showing the name, country and time zone fields.",
          "The workspace step, right after confirming your email.",
        ),
        h2("Connect your first channel"),
        p(
          "Once the workspace exists, Flovoo asks you to connect at least one channel. Start with WhatsApp, since it is the channel most of your customers already use, and add Instagram and Messenger later from the channels page.",
        ),
        callout(
          "tip",
          "You can skip the channel for now and come back to it from ",
          b("Settings → Channels"),
          " at any time. Nothing else depends on it.",
        ),
        h2("Set business hours"),
        p(
          "Business hours decide when the out-of-hours auto-reply goes out and how reply time is measured in reports. Under ",
          b("Settings → Business hours"),
          " choose your working days and hours. A day can have more than one period.",
        ),
        h3("What next?"),
        ul(
          ["Invite your team and set their roles — see “Invite your team and set roles”."],
          ["Build your first auto-reply to greet customers outside business hours."],
          ["Import contacts from a CSV file if you already have a customer list."],
        ),
      ),
    },
  },
  {
    n: 2,
    collection_id: GETTING_STARTED,
    status: "published",
    sort_order: 2,
    section: { ar: "الفريق", en: "Your team" },
    icon: "users",
    created_days_ago: 78,
    updated_days_ago: 20,
    ar: {
      slug: "دعوة-الفريق-وتحديد-الأدوار",
      title: "دعوة فريقك وتحديد الأدوار",
      excerpt: "أضف زملاءك إلى مساحة العمل، وامنح كل عضو الصلاحيات التي يحتاجها فقط.",
      body: doc(
        p(
          "كل عضو في الفريق يحصل على حسابه الخاص داخل مساحة العمل. الدور (Role) يحدد ما يراه وما يمكنه تغييره.",
        ),
        h2("إرسال الدعوة"),
        steps(
          ["من ", b("الإعدادات ← الفريق"), " اضغط ", b("دعوة عضو"), "."],
          ["أدخل البريد الإلكتروني واختر الدور المناسب."],
          ["اضغط ", b("أرسل الدعوة"), ". تصل رسالة إلى زميلك تحتوي على رابط الانضمام، وتبقى صالحة لمدة سبعة أيام."],
        ),
        h2("الأدوار المتاحة"),
        table(
          ["الدور", "يرى", "يمكنه"],
          ["مدير", "كل المحادثات والإعدادات والفوترة", "كل شيء، بما فيه دعوة الأعضاء وحذفهم"],
          ["موظف دعم", "المحادثات المسندة إليه وإلى فريقه", "الرد، وإسناد المحادثات، واستخدام الردود المحفوظة"],
          ["مراقب", "المحادثات والتقارير", "القراءة فقط دون الرد أو التعديل"],
        ),
        callout(
          "info",
          "يمكنك تغيير دور أي عضو في أي وقت. التغيير يسري فورًا ولا يؤثر على المحادثات الجارية.",
        ),
        h2("إزالة عضو"),
        p(
          "من صفحة الفريق افتح قائمة العضو واختر ",
          b("إزالة من المساحة"),
          ". تبقى محادثاته وردوده كما هي في السجل، وتُعاد المحادثات المسندة إليه إلى قائمة «غير مسندة».",
        ),
      ),
    },
    en: {
      slug: "invite-your-team-and-set-roles",
      title: "Invite your team and set roles",
      excerpt: "Add colleagues to the workspace and give each person only the permissions they need.",
      body: doc(
        p(
          "Everyone on the team gets their own account inside the workspace. Their role decides what they see and what they can change.",
        ),
        h2("Send an invitation"),
        steps(
          ["Under ", b("Settings → Team"), " press ", b("Invite member"), "."],
          ["Enter their email address and choose a role."],
          ["Press ", b("Send invitation"), ". Your colleague receives an email with a join link that stays valid for seven days."],
        ),
        h2("Available roles"),
        table(
          ["Role", "Sees", "Can"],
          ["Admin", "All conversations, settings and billing", "Everything, including inviting and removing members"],
          ["Agent", "Conversations assigned to them and their team", "Reply, assign conversations and use saved replies"],
          ["Viewer", "Conversations and reports", "Read only, without replying or editing"],
        ),
        callout(
          "info",
          "You can change anyone's role at any time. The change applies immediately and does not disturb conversations in flight.",
        ),
        h2("Remove a member"),
        p(
          "On the team page, open the member's menu and choose ",
          b("Remove from workspace"),
          ". Their conversations and replies stay in the history, and anything assigned to them returns to the “Unassigned” list.",
        ),
      ),
    },
  },

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  {
    n: 3,
    collection_id: WHATSAPP,
    status: "published",
    is_pinned: true,
    sort_order: 1,
    section: { ar: "الإعداد", en: "Setup" },
    icon: "plug",
    created_days_ago: 75,
    updated_days_ago: 3,
    ar: {
      slug: "ربط-واتساب-بفلوفو",
      title: "ربط واتساب بفلوفو",
      excerpt: "اربط رقم واتساب للأعمال (WhatsApp Business) بمساحة عملك واستقبل الرسائل في صندوق الوارد.",
      body: doc(
        p(
          "يعمل فلوفو عبر واجهة واتساب للأعمال الرسمية (WhatsApp Business Platform). هذا يعني أن رقمك يبقى ملكك، ويمكن لأكثر من عضو في الفريق الرد منه في الوقت نفسه.",
        ),
        h2("قبل أن تبدأ"),
        ul(
          ["حساب على ", link("Meta Business", "https://business.facebook.com"), " لديك فيه صلاحية مدير."],
          ["رقم هاتف يستطيع استقبال رسالة نصية أو مكالمة للتحقق."],
          ["الرقم غير مستخدم حاليًا في تطبيق واتساب أو واتساب للأعمال على الهاتف. إن كان مستخدمًا، احذف الحساب من التطبيق أولًا."],
        ),
        callout(
          "warning",
          "حذف حساب واتساب من الهاتف يمسح سجل المحادثات القديم من الجهاز. صدّر المحادثات المهمة قبل ذلك.",
        ),
        h2("خطوات الربط"),
        steps(
          ["من ", b("الإعدادات ← القنوات"), " اضغط ", b("ربط واتساب"), "."],
          ["سجّل دخولك إلى حساب Meta واختر حساب الأعمال الذي تريد استخدامه."],
          ["أدخل رقم الهاتف بصيغته الدولية، مثل ", ltr("+966 5X XXX XXXX"), "، واختر طريقة التحقق."],
          ["أدخل رمز التحقق المكوّن من ستة أرقام."],
          ["اكتب اسم العرض الذي سيراه العملاء. يجب أن يطابق اسم نشاطك التجاري."],
        ),
        figure(
          "/help/whatsapp-connect.svg",
          "نافذة ربط واتساب تعرض قائمة حسابات الأعمال وحقل رقم الهاتف.",
          "اختيار حساب الأعمال وإدخال الرقم خلال الربط.",
        ),
        h2("بعد الربط"),
        p(
          "تصل الرسائل الجديدة إلى صندوق الوارد خلال دقائق. أرسل رسالة اختبار من هاتفك إلى الرقم لتتأكد من أن كل شيء يعمل، ثم رُدّ عليها من فلوفو.",
        ),
        h2("أسئلة شائعة"),
        faq(
          ["هل يمكن ربط أكثر من رقم؟", "نعم. كل رقم يظهر كقناة مستقلة في صندوق الوارد، ويمكنك تحديد الفريق المسؤول عن كل رقم."],
          ["هل أفقد المحادثات القديمة؟", "المحادثات التي جرت عبر تطبيق الهاتف لا تنتقل إلى فلوفو. تبدأ الرسائل بالظهور من لحظة الربط."],
          ["ماذا لو لم يصلني رمز التحقق؟", "انتظر دقيقتين ثم اطلب الرمز عبر مكالمة بدل الرسالة النصية. إن استمر التعذّر، تأكد من أن الرقم غير مسجّل في تطبيق آخر."],
        ),
      ),
    },
    en: {
      slug: "connect-whatsapp",
      title: "Connect WhatsApp to Flovoo",
      excerpt: "Link a WhatsApp Business number to your workspace and receive messages in the inbox.",
      body: doc(
        p(
          "Flovoo works through the official WhatsApp Business Platform. Your number stays yours, and more than one person on the team can reply from it at the same time.",
        ),
        h2("Before you start"),
        ul(
          ["A ", link("Meta Business", "https://business.facebook.com"), " account where you have admin rights."],
          ["A phone number that can receive an SMS or a call for verification."],
          ["The number is not currently used in the WhatsApp or WhatsApp Business app on a phone. If it is, delete the account from the app first."],
        ),
        callout(
          "warning",
          "Deleting a WhatsApp account from a phone removes the old chat history from that device. Export the conversations you care about first.",
        ),
        h2("Connect the number"),
        steps(
          ["Under ", b("Settings → Channels"), " press ", b("Connect WhatsApp"), "."],
          ["Sign in to Meta and choose the business account you want to use."],
          ["Enter the phone number in international format, such as ", ltr("+966 5X XXX XXXX"), ", and pick a verification method."],
          ["Enter the six-digit verification code."],
          ["Type the display name customers will see. It has to match your business name."],
        ),
        figure(
          "/help/whatsapp-connect.svg",
          "The WhatsApp connection dialog showing the list of business accounts and the phone number field.",
          "Choosing the business account and entering the number during setup.",
        ),
        h2("After connecting"),
        p(
          "New messages reach the inbox within minutes. Send a test message from your own phone to the number to confirm everything works, then reply to it from Flovoo.",
        ),
        h2("Frequently asked"),
        faq(
          ["Can I connect more than one number?", "Yes. Each number appears as its own channel in the inbox, and you can decide which team looks after each one."],
          ["Do I lose old conversations?", "Chats that happened in the phone app do not move to Flovoo. Messages start appearing from the moment you connect."],
          ["What if the verification code never arrives?", "Wait two minutes, then request the code by call instead of SMS. If it still fails, check that the number is not registered in another app."],
        ),
      ),
    },
  },
  {
    n: 4,
    collection_id: WHATSAPP,
    status: "published",
    sort_order: 2,
    section: { ar: "الإعداد", en: "Setup" },
    icon: "layout-template",
    created_days_ago: 70,
    updated_days_ago: 14,
    ar: {
      slug: "قوالب-رسائل-واتساب",
      title: "قوالب رسائل واتساب: الإنشاء والاعتماد",
      excerpt: "متى تحتاج إلى قالب، وكيف تكتبه بطريقة تعتمدها Meta من المرة الأولى.",
      body: doc(
        p(
          "يشترط واتساب استخدام قالب (Template) معتمد مسبقًا عند مراسلة عميل لم يكتب لك خلال آخر 24 ساعة. داخل هذه النافذة يمكنك الرد بحرية دون قوالب.",
        ),
        h2("أنواع القوالب"),
        table(
          ["النوع", "الاستخدام", "مثال"],
          ["خدمية", "تحديثات الطلبات والمواعيد والفواتير", "«طلبك رقم 4821 في طريقه إليك»"],
          ["تسويقية", "العروض والحملات والإعلانات", "«خصم 20% على مجموعة الشتاء حتى الجمعة»"],
          ["مصادقة", "رموز التحقق لمرة واحدة", "«رمز الدخول الخاص بك هو 583920»"],
        ),
        h2("إنشاء قالب"),
        steps(
          ["من ", b("الإعدادات ← قوالب واتساب"), " اضغط ", b("قالب جديد"), "."],
          ["اختر النوع واللغة. أنشئ نسخة عربية ونسخة إنجليزية إن كان عملاؤك يكتبون باللغتين."],
          ["اكتب النص واستخدم المتغيرات مثل ", code("{{1}}"), " للاسم أو رقم الطلب."],
          ["أضف مثالًا حقيقيًا لكل متغير. تحتاجه Meta لفهم سياق الرسالة."],
          ["اضغط ", b("أرسل للاعتماد"), ". يصل الرد عادةً خلال دقائق، وقد يستغرق حتى 24 ساعة."],
        ),
        callout(
          "info",
          "القوالب التي تحتوي على عبارات ملحّة مثل «اضغط الآن» أو روابط مختصرة تُرفض غالبًا. اكتب بلغة واضحة ومباشرة.",
        ),
        h2("لماذا رُفض قالبي؟"),
        ul(
          ["النص تسويقي لكن النوع المختار «خدمية». غيّر النوع وأعد الإرسال."],
          ["المتغيرات في بداية الرسالة أو نهايتها دون نص حولها."],
          ["وجود أخطاء إملائية كثيرة أو خلط بين لغتين في القالب نفسه."],
        ),
      ),
    },
    en: {
      slug: "whatsapp-message-templates",
      title: "WhatsApp message templates: create and get approval",
      excerpt: "When you need a template, and how to write one Meta approves the first time.",
      body: doc(
        p(
          "WhatsApp requires a pre-approved template when you message a customer who has not written to you in the last 24 hours. Inside that window you can reply freely without templates.",
        ),
        h2("Template categories"),
        table(
          ["Category", "Use", "Example"],
          ["Utility", "Order, appointment and invoice updates", "“Your order 4821 is on its way”"],
          ["Marketing", "Offers, campaigns and announcements", "“20% off the winter collection until Friday”"],
          ["Authentication", "One-time verification codes", "“Your sign-in code is 583920”"],
        ),
        h2("Create a template"),
        steps(
          ["Under ", b("Settings → WhatsApp templates"), " press ", b("New template"), "."],
          ["Choose the category and language. Create an Arabic and an English version if your customers write in both."],
          ["Write the text and use variables such as ", code("{{1}}"), " for a name or an order number."],
          ["Add a realistic sample for every variable. Meta needs it to understand the context."],
          ["Press ", b("Submit for approval"), ". A decision usually arrives within minutes and can take up to 24 hours."],
        ),
        callout(
          "info",
          "Templates with urgent phrasing such as “click now” or shortened links are often rejected. Write plainly and directly.",
        ),
        h2("Why was my template rejected?"),
        ul(
          ["The text is promotional but the category is “Utility”. Change the category and resubmit."],
          ["Variables sit at the very start or end of the message with no text around them."],
          ["Many spelling mistakes, or two languages mixed in the same template."],
        ),
      ),
    },
  },
  {
    // Arabic only, on purpose: exercises the missing-translation notice.
    n: 5,
    collection_id: WHATSAPP,
    status: "published",
    sort_order: 3,
    section: { ar: "حل المشكلات", en: "Troubleshooting" },
    icon: "triangle-alert",
    created_days_ago: 40,
    updated_days_ago: 9,
    ar: {
      slug: "لماذا-لا-تصل-رسائل-واتساب",
      title: "لماذا لا تصل رسائل واتساب؟",
      excerpt: "الأسباب الأكثر شيوعًا لتأخر الرسائل أو فشلها، وكيف تتحقق من كل سبب.",
      body: doc(
        p(
          "عندما تفشل رسالة، يعرض فلوفو رمز الخطأ بجانبها في المحادثة. ابدأ بالرمز، فهو يختصر معظم التشخيص.",
        ),
        h2("تحقق من هذه الأسباب أولًا"),
        ul(
          [b("نافذة الـ 24 ساعة انتهت."), " العميل لم يكتب لك منذ أكثر من يوم، فيلزم قالب معتمد. الرمز المعتاد هنا ", ltr("131047"), "."],
          [b("الرقم غير مسجّل في واتساب."), " تأكد من الرقم مع العميل، أو أن الرقم ليس خطًا أرضيًا."],
          [b("العميل حظر رقمك."), " لا يصل لك إشعار بالحظر، لكن الرسائل تبقى بعلامة واحدة دون تسليم."],
          [b("جودة الرقم منخفضة."), " كثرة البلاغات تخفض جودة الرقم وتحدّ من عدد الرسائل اليومية. راجع الجودة من ", b("الإعدادات ← القنوات"), "."],
        ),
        h2("التأخر دون فشل"),
        p(
          "قد تتأخر الرسائل بضع دقائق أثناء أعطال Meta العامة. تابع حالة المنصة من ",
          link("صفحة حالة Meta", "https://metastatus.com/whatsapp-business-api"),
          "، ولا تعد إرسال الرسالة نفسها مرارًا فذلك يزيد التأخير.",
        ),
        h2("أسئلة شائعة"),
        faq(
          ["هل تُحتسب الرسالة الفاشلة في فاتورتي؟", "لا. تُحتسب المحادثات المسلّمة فقط."],
          ["كيف أرفع جودة الرقم؟", "قلّل الرسائل التسويقية لمن لم يتفاعل معك، وأضف طريقة سهلة لإلغاء الاشتراك في كل حملة."],
        ),
      ),
    },
  },

  // ── Inbox ─────────────────────────────────────────────────────────────────
  {
    n: 6,
    collection_id: INBOX,
    status: "published",
    sort_order: 1,
    section: { ar: "العمل اليومي", en: "Daily work" },
    icon: "user-check",
    created_days_ago: 68,
    updated_days_ago: 25,
    ar: {
      slug: "إسناد-المحادثات-إلى-الفريق",
      title: "إسناد المحادثات إلى الفريق",
      excerpt: "وزّع المحادثات يدويًا أو تلقائيًا حتى يعرف كل عضو ما عليه الرد عليه.",
      body: doc(
        p(
          "كل محادثة في صندوق الوارد إما مسندة إلى شخص، أو إلى فريق، أو غير مسندة. الهدف أن تبقى قائمة «غير مسندة» فارغة قدر الإمكان.",
        ),
        h2("الإسناد اليدوي"),
        steps(
          ["افتح المحادثة واضغط على أيقونة الإسناد في أعلى النافذة."],
          ["اختر شخصًا أو فريقًا من القائمة. يمكنك كتابة الاسم للبحث."],
          ["يصل إشعار إلى من أسندت إليه المحادثة، وتظهر في قائمته فورًا."],
        ),
        h2("الإسناد التلقائي"),
        p(
          "من ",
          b("الإعدادات ← التوجيه"),
          " اختر طريقة التوزيع لكل قناة:",
        ),
        ul(
          [b("بالتناوب:"), " توزّع المحادثات الجديدة بالتساوي على أعضاء الفريق المتاحين."],
          [b("الأقل انشغالًا:"), " تذهب المحادثة إلى من لديه أقل عدد من المحادثات المفتوحة."],
          [b("يدوي:"), " تبقى المحادثات في «غير مسندة» حتى يلتقطها أحد."],
        ),
        callout(
          "tip",
          "فعّل حالة «غير متاح» عند الاستراحة حتى لا تُسند إليك محادثات جديدة، وتُوزّع على بقية الفريق.",
        ),
      ),
    },
    en: {
      slug: "assign-conversations-to-your-team",
      title: "Assign conversations to your team",
      excerpt: "Route conversations by hand or automatically so everyone knows what to reply to.",
      body: doc(
        p(
          "Every conversation in the inbox is assigned to a person, to a team, or to nobody. The goal is to keep the “Unassigned” list as close to empty as you can.",
        ),
        h2("Assign by hand"),
        steps(
          ["Open the conversation and press the assign icon at the top."],
          ["Pick a person or a team from the list. Type a name to search."],
          ["The assignee gets a notification and the conversation appears in their list right away."],
        ),
        h2("Assign automatically"),
        p(
          "Under ",
          b("Settings → Routing"),
          " choose how each channel distributes new conversations:",
        ),
        ul(
          [b("Round robin:"), " new conversations are spread evenly across available team members."],
          [b("Least busy:"), " the conversation goes to whoever has the fewest open conversations."],
          [b("Manual:"), " conversations stay in “Unassigned” until someone picks them up."],
        ),
        callout(
          "tip",
          "Set yourself to “Away” during breaks so no new conversations land on you, and they go to the rest of the team instead.",
        ),
      ),
    },
  },
  {
    n: 7,
    collection_id: INBOX,
    status: "published",
    is_pinned: true,
    sort_order: 2,
    section: { ar: "العمل اليومي", en: "Daily work" },
    icon: "message-square-text",
    created_days_ago: 60,
    updated_days_ago: 12,
    ar: {
      slug: "الردود-المحفوظة-والاختصارات",
      title: "الردود المحفوظة والاختصارات",
      excerpt: "احفظ الإجابات المتكررة واستدعها بكتابة «/» متبوعة باختصار قصير.",
      body: doc(
        p(
          "الرد المحفوظ (Saved reply) هو نص جاهز تستدعيه بضغطتين بدل كتابته كل مرة. الفرق يظهر في نهاية اليوم: آلاف الحروف التي لم تكتبها.",
        ),
        h2("إنشاء رد محفوظ"),
        steps(
          ["من ", b("الإعدادات ← الردود المحفوظة"), " اضغط ", b("رد جديد"), "."],
          ["اكتب اختصارًا قصيرًا بلا مسافات، مثل ", code("شحن"), " أو ", code("مواعيد"), "."],
          ["اكتب نص الرد. استخدم ", code("{الاسم}"), " لإدراج اسم العميل تلقائيًا و", code("{رقم_الطلب}"), " لرقم طلبه."],
          ["اختر إن كان الرد خاصًا بك أو مشتركًا مع الفريق كله."],
        ),
        h2("استخدامه في المحادثة"),
        p(
          "في مربع الكتابة اكتب ",
          code("/"),
          " ثم أول حروف الاختصار، واختر الرد من القائمة بالسهم ثم ",
          code("Enter"),
          ". يمكنك تعديل النص قبل الإرسال.",
        ),
        callout(
          "tip",
          "إن كان عملاؤك يكتبون بلغتين، أنشئ نسخة عربية ونسخة إنجليزية للاختصار نفسه. يختار فلوفو النسخة المناسبة حسب لغة المحادثة.",
        ),
        h2("ترتيب الردود"),
        p(
          "الردود الأكثر استخدامًا تظهر أولًا في القائمة تلقائيًا. لتنظيمها أكثر، ضع الردود في مجلدات مثل «الشحن» و«الإرجاع» و«الأسعار».",
        ),
      ),
    },
    en: {
      slug: "saved-replies-and-shortcuts",
      title: "Saved replies and shortcuts",
      excerpt: "Save the answers you repeat and recall them by typing “/” plus a short shortcut.",
      body: doc(
        p(
          "A saved reply is a ready-made answer you insert with two keystrokes instead of typing it out every time. The difference shows at the end of the day: thousands of characters you did not type.",
        ),
        h2("Create a saved reply"),
        steps(
          ["Under ", b("Settings → Saved replies"), " press ", b("New reply"), "."],
          ["Write a short shortcut without spaces, such as ", code("shipping"), " or ", code("hours"), "."],
          ["Write the reply. Use ", code("{name}"), " to insert the customer's name automatically and ", code("{order_number}"), " for their order."],
          ["Choose whether the reply is yours alone or shared with the whole team."],
        ),
        h2("Use it in a conversation"),
        p(
          "In the composer type ",
          code("/"),
          " followed by the first letters of the shortcut, pick the reply with the arrow keys and press ",
          code("Enter"),
          ". You can edit the text before sending.",
        ),
        callout(
          "tip",
          "If your customers write in two languages, create an Arabic and an English version of the same shortcut. Flovoo picks the right one for the conversation's language.",
        ),
        h2("Keep replies organised"),
        p(
          "The replies you use most float to the top of the list on their own. For more structure, group replies into folders such as “Shipping”, “Returns” and “Pricing”.",
        ),
      ),
    },
  },

  // ── Automation ────────────────────────────────────────────────────────────
  {
    n: 8,
    collection_id: AUTOMATION,
    status: "published",
    sort_order: 1,
    section: { ar: "الردود الآلية", en: "Auto-replies" },
    icon: "zap",
    created_days_ago: 55,
    updated_days_ago: 5,
    ar: {
      slug: "إنشاء-أول-رد-آلي",
      title: "إنشاء أول رد آلي",
      excerpt: "رحّب بالعملاء فورًا، وأخبرهم بموعد الرد خارج ساعات العمل، دون أن يكتب أحد حرفًا.",
      body: doc(
        p(
          "الرد الآلي (Auto-reply) رسالة تُرسل تلقائيًا عند شرط معيّن: وصول رسالة جديدة، أو رسالة خارج ساعات العمل، أو كلمة مفتاحية بعينها.",
        ),
        h2("إنشاء رد خارج ساعات العمل"),
        steps(
          ["من ", b("الأتمتة ← الردود الآلية"), " اضغط ", b("رد جديد"), "."],
          ["اختر المحفّز ", b("رسالة خارج ساعات العمل"), ". يعتمد على الساعات التي حددتها في الإعدادات."],
          ["اكتب الرسالة. اذكر موعد عودتكم بوضوح، مثل: «شكرًا لرسالتك. نعود إليك غدًا من الساعة 9 صباحًا»."],
          ["اختر القنوات التي يعمل عليها الرد، ثم اضغط ", b("تفعيل"), "."],
        ),
        figure(
          "/help/auto-reply-builder.svg",
          "منشئ الردود الآلية يعرض المحفّز على اليمين ونص الرسالة على اليسار.",
          "الرد الآلي خارج ساعات العمل بعد اختيار المحفّز.",
        ),
        callout(
          "info",
          "يُرسل الرد مرة واحدة لكل محادثة كل 12 ساعة حتى لا يتلقى العميل الرسالة نفسها مع كل سطر يكتبه.",
        ),
        h2("ردود بالكلمات المفتاحية"),
        p(
          "اختر المحفّز ",
          b("كلمة مفتاحية"),
          " وأدخل الكلمات التي تطلق الرد، مثل «الأسعار» أو «المواعيد». يتعرف فلوفو على الكلمة مع «ال» أو بدونها ومع اختلاف الهمزات، فلا تحتاج إلى إدخال كل صيغة.",
        ),
        h3("متى لا تستخدم الرد الآلي"),
        ul(
          ["عندما يحتاج السؤال إلى فهم السياق. هنا يكون وكيل الذكاء الاصطناعي أنسب."],
          ["للعملاء الذين في محادثة جارية مع موظف بالفعل. الرد الآلي يتوقف تلقائيًا في هذه الحالة."],
        ),
      ),
    },
    en: {
      slug: "build-your-first-auto-reply",
      title: "Build your first auto-reply",
      excerpt: "Greet customers instantly and tell them when to expect a reply outside business hours, without anyone typing a word.",
      body: doc(
        p(
          "An auto-reply is a message sent automatically on a condition: a new message arrives, a message comes in outside business hours, or a specific keyword appears.",
        ),
        h2("Create an out-of-hours reply"),
        steps(
          ["Under ", b("Automation → Auto-replies"), " press ", b("New reply"), "."],
          ["Choose the trigger ", b("Message outside business hours"), ". It follows the hours you set in Settings."],
          ["Write the message. Say clearly when you will be back, for example: “Thanks for your message. We reply tomorrow from 9 am.”"],
          ["Pick the channels the reply applies to, then press ", b("Enable"), "."],
        ),
        figure(
          "/help/auto-reply-builder.svg",
          "The auto-reply builder showing the trigger on one side and the message text on the other.",
          "The out-of-hours auto-reply after choosing its trigger.",
        ),
        callout(
          "info",
          "The reply is sent once per conversation every 12 hours, so a customer does not get the same message for every line they type.",
        ),
        h2("Keyword replies"),
        p(
          "Choose the trigger ",
          b("Keyword"),
          " and enter the words that fire the reply, such as “prices” or “opening hours”. Flovoo matches Arabic keywords with or without the definite article and across hamza spellings, so you do not need to enter every variant.",
        ),
        h3("When not to use an auto-reply"),
        ul(
          ["When the question needs context. That is where the AI agent fits better."],
          ["For customers already in a conversation with an agent. Auto-replies pause automatically in that case."],
        ),
      ),
    },
  },

  // ── Campaigns ─────────────────────────────────────────────────────────────
  {
    n: 9,
    collection_id: CAMPAIGNS,
    status: "published",
    sort_order: 1,
    section: { ar: "الإرسال", en: "Sending" },
    icon: "send",
    created_days_ago: 50,
    updated_days_ago: 16,
    ar: {
      slug: "إرسال-أول-حملة-واتساب",
      title: "إرسال أول حملة واتساب",
      excerpt: "اختر الجمهور، واستخدم قالبًا معتمدًا، وتابع من قرأ ومن ردّ.",
      body: doc(
        p(
          "الحملة (Campaign) رسالة واتساب تُرسل إلى مجموعة من جهات الاتصال في وقت واحد. تحتاج إلى قالب تسويقي معتمد وإلى موافقة العملاء على استلام رسائلك.",
        ),
        callout(
          "warning",
          "أرسل الحملات فقط لمن وافق على استلام رسائلك. البلاغات المتكررة تخفض جودة رقمك وقد توقفه مؤقتًا.",
        ),
        h2("إنشاء الحملة"),
        steps(
          ["من ", b("الحملات"), " اضغط ", b("حملة جديدة"), " واختر الرقم المرسل."],
          ["حدّد الجمهور: كل جهات الاتصال، أو وسم معيّن، أو ملف CSV تستورده الآن."],
          ["اختر القالب المعتمد واملأ متغيراته. يمكنك ربط كل متغير بحقل من جهة الاتصال."],
          ["راجع المعاينة على الهاتف، ثم اختر ", b("أرسل الآن"), " أو حدّد وقتًا لاحقًا."],
        ),
        h2("قراءة النتائج"),
        table(
          ["المقياس", "معناه"],
          ["أُرسلت", "خرجت الرسالة من فلوفو إلى واتساب"],
          ["سُلّمت", "وصلت إلى هاتف العميل"],
          ["قُرئت", "فتح العميل الرسالة (إن كانت إشعارات القراءة مفعّلة عنده)"],
          ["ردّ", "كتب العميل ردًا، وتظهر محادثته في صندوق الوارد"],
        ),
        p(
          "الردود على الحملة تصل إلى صندوق الوارد كمحادثات عادية، ويمكن توجيهها تلقائيًا إلى فريق المبيعات من إعدادات التوجيه.",
        ),
      ),
    },
    en: {
      slug: "send-your-first-whatsapp-campaign",
      title: "Send your first WhatsApp campaign",
      excerpt: "Pick the audience, use an approved template and follow who read and who replied.",
      body: doc(
        p(
          "A campaign is a WhatsApp message sent to a group of contacts at once. It needs an approved marketing template and customers who agreed to hear from you.",
        ),
        callout(
          "warning",
          "Send campaigns only to people who opted in. Repeated reports lower your number's quality rating and can pause it temporarily.",
        ),
        h2("Create the campaign"),
        steps(
          ["Under ", b("Campaigns"), " press ", b("New campaign"), " and choose the sending number."],
          ["Define the audience: all contacts, a specific tag, or a CSV file you import now."],
          ["Choose the approved template and fill in its variables. Each variable can map to a contact field."],
          ["Check the phone preview, then choose ", b("Send now"), " or schedule a time."],
        ),
        h2("Read the results"),
        table(
          ["Metric", "Meaning"],
          ["Sent", "The message left Flovoo for WhatsApp"],
          ["Delivered", "It reached the customer's phone"],
          ["Read", "The customer opened it (if they have read receipts on)"],
          ["Replied", "The customer wrote back, and the conversation appears in the inbox"],
        ),
        p(
          "Replies to a campaign land in the inbox as ordinary conversations, and routing rules can send them straight to the sales team.",
        ),
      ),
    },
  },

  // ── Billing ───────────────────────────────────────────────────────────────
  {
    n: 10,
    collection_id: BILLING,
    status: "published",
    sort_order: 1,
    section: { ar: "الاشتراك", en: "Subscription" },
    icon: "wallet",
    created_days_ago: 45,
    updated_days_ago: 30,
    ar: {
      slug: "الخطط-والأسعار-والترقية",
      title: "الخطط والأسعار وكيفية الترقية",
      excerpt: "ما الذي تتضمنه كل خطة، وكيف تغيّر خطتك دون انقطاع في الخدمة.",
      body: doc(
        p(
          "تُحسب خطط فلوفو بعدد مقاعد الفريق شهريًا، إضافة إلى رسوم محادثات واتساب التي تفرضها Meta وتمرّ عبر فاتورتك دون زيادة.",
        ),
        h2("مقارنة الخطط"),
        table(
          ["", "الأساسية", "الاحترافية", "الأعمال"],
          ["القنوات", "واتساب وقناة أخرى", "كل القنوات", "كل القنوات"],
          ["المقاعد", "حتى 3", "حتى 15", "غير محدودة"],
          ["الأتمتة", "ردود آلية", "ردود آلية وتوجيه", "كل ذلك ووكيل الذكاء الاصطناعي"],
          ["التقارير", "أساسية", "متقدمة", "متقدمة مع التصدير"],
        ),
        h2("الترقية أو التخفيض"),
        steps(
          ["من ", b("الإعدادات ← الفوترة"), " اضغط ", b("تغيير الخطة"), "."],
          ["اختر الخطة الجديدة. تظهر لك الفروق في السعر قبل التأكيد."],
          ["تسري الترقية فورًا ويُحسب الفرق نسبيًا لبقية الشهر. أما التخفيض فيسري من بداية دورة الفوترة التالية."],
        ),
        h2("أسئلة شائعة"),
        faq(
          ["هل توجد فترة تجريبية؟", "نعم، 14 يومًا على الخطة الاحترافية دون بطاقة. بعدها تختار خطة أو ينتقل الحساب إلى وضع القراءة فقط."],
          ["كيف تُحسب رسوم واتساب؟", "تفرض Meta رسمًا على كل محادثة تبدأها أنت خلال 24 ساعة، ويختلف حسب الدولة والنوع. المحادثات التي يبدأها العميل ضمن نافذة الخدمة مجانية."],
          ["هل يمكن الدفع سنويًا؟", "نعم، بخصم شهرين على كل الخطط. تواصل معنا من داخل التطبيق لتحويل اشتراكك."],
        ),
      ),
    },
    en: {
      slug: "plans-pricing-and-upgrading",
      title: "Plans, pricing and how to upgrade",
      excerpt: "What each plan includes, and how to change plans without interrupting service.",
      body: doc(
        p(
          "Flovoo plans are priced per team seat per month, plus the WhatsApp conversation fees that Meta charges, passed through on your invoice without mark-up.",
        ),
        h2("Compare plans"),
        table(
          ["", "Starter", "Professional", "Business"],
          ["Channels", "WhatsApp plus one more", "All channels", "All channels"],
          ["Seats", "Up to 3", "Up to 15", "Unlimited"],
          ["Automation", "Auto-replies", "Auto-replies and routing", "All of that plus the AI agent"],
          ["Reports", "Basic", "Advanced", "Advanced with export"],
        ),
        h2("Upgrade or downgrade"),
        steps(
          ["Under ", b("Settings → Billing"), " press ", b("Change plan"), "."],
          ["Choose the new plan. The price difference is shown before you confirm."],
          ["An upgrade applies immediately and is prorated for the rest of the month. A downgrade applies from the start of the next billing cycle."],
        ),
        h2("Frequently asked"),
        faq(
          ["Is there a trial?", "Yes, 14 days on the Professional plan with no card. After that you pick a plan or the account switches to read-only."],
          ["How are WhatsApp fees calculated?", "Meta charges a fee for every conversation you start within 24 hours, varying by country and category. Conversations the customer starts inside the service window are free."],
          ["Can I pay yearly?", "Yes, with two months off on every plan. Contact us from inside the app to switch."],
        ),
      ),
    },
  },
  {
    n: 11,
    collection_id: BILLING,
    status: "published",
    sort_order: 2,
    section: { ar: "الفواتير", en: "Invoices" },
    icon: "receipt",
    created_days_ago: 44,
    updated_days_ago: 44,
    ar: {
      slug: "تحديث-بيانات-الفوترة-والفواتير",
      title: "تحديث بيانات الفوترة وتنزيل الفواتير",
      excerpt: "غيّر البطاقة، وأضف الرقم الضريبي، ونزّل فواتيرك الشهرية بصيغة PDF.",
      body: doc(
        h2("تغيير طريقة الدفع"),
        steps(
          ["من ", b("الإعدادات ← الفوترة"), " اضغط ", b("طريقة الدفع"), "."],
          ["أدخل بيانات البطاقة الجديدة. نقبل فيزا وماستركارد ومدى."],
          ["تُستخدم البطاقة الجديدة من الفاتورة التالية، وتُحذف القديمة تلقائيًا."],
        ),
        h2("إضافة الرقم الضريبي"),
        p(
          "في قسم ",
          b("بيانات الفاتورة"),
          " أدخل اسم المنشأة والعنوان والرقم الضريبي، مثل ",
          ltr("3XXXXXXXXXXXXX3"),
          ". يظهر على كل فاتورة تُصدر بعد الحفظ، ولا يمكن تعديل الفواتير السابقة.",
        ),
        h2("تنزيل الفواتير"),
        p(
          "تجد كل الفواتير في جدول ",
          b("سجل الفواتير"),
          " مع حالتها ومبلغها. اضغط على أيقونة التنزيل لحفظ نسخة PDF، أو فعّل ",
          b("أرسل الفواتير بالبريد"),
          " لتصل تلقائيًا إلى بريد المحاسبة كل شهر.",
        ),
      ),
    },
    en: {
      slug: "update-billing-details-and-download-invoices",
      title: "Update billing details and download invoices",
      excerpt: "Change your card, add your tax number and download monthly invoices as PDF.",
      body: doc(
        h2("Change the payment method"),
        steps(
          ["Under ", b("Settings → Billing"), " press ", b("Payment method"), "."],
          ["Enter the new card details. Visa, Mastercard and mada are accepted."],
          ["The new card is used from the next invoice, and the old one is removed automatically."],
        ),
        h2("Add a tax number"),
        p(
          "In the ",
          b("Invoice details"),
          " section enter the company name, address and tax number, such as ",
          ltr("3XXXXXXXXXXXXX3"),
          ". It appears on every invoice issued after you save. Earlier invoices cannot be edited.",
        ),
        h2("Download invoices"),
        p(
          "All invoices are listed in the ",
          b("Invoice history"),
          " table with their status and amount. Press the download icon to save a PDF, or turn on ",
          b("Email invoices"),
          " so they reach your accounting inbox automatically each month.",
        ),
      ),
    },
  },

  // ── Draft (must never reach the public site) ──────────────────────────────
  {
    n: 12,
    collection_id: INBOX,
    status: "draft",
    sort_order: 3,
    section: { ar: "العمل اليومي", en: "Daily work" },
    icon: "download",
    created_days_ago: 2,
    updated_days_ago: 1,
    ar: {
      slug: "تصدير-المحادثات",
      title: "تصدير المحادثات",
      excerpt: "مسودة: كيفية تصدير محادثة أو أرشيف كامل إلى ملف.",
      body: doc(p("مسودة قيد الكتابة.")),
    },
    en: {
      slug: "export-conversations",
      title: "Export conversations",
      excerpt: "Draft: exporting a conversation or a full archive to a file.",
      body: doc(p("Draft in progress.")),
    },
  },
];

// ---------------------------------------------------------------------------
// Flatten into the table shapes
// ---------------------------------------------------------------------------

const articleId = (n: number) => `a1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const translationId = (n: number, language: Locale) =>
  `${language === "ar" ? "b1" : "b2"}000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const HELP_ARTICLES: HelpArticle[] = SEED_ARTICLES.map((a) => ({
  id: articleId(a.n),
  collection_id: a.collection_id,
  status: a.status,
  is_pinned: a.is_pinned ?? false,
  sort_order: a.sort_order,
  section_ar: a.section?.ar ?? null,
  section_en: a.section?.en ?? null,
  icon: a.icon ?? "file-text",
  created_at: daysAgo(a.created_days_ago),
  updated_at: daysAgo(a.updated_days_ago),
  published_at: a.status === "published" ? daysAgo(a.created_days_ago) : null,
}));

function translation(
  a: SeedArticle,
  language: Locale,
  t: SeedTranslation,
): HelpArticleTranslation {
  return {
    id: translationId(a.n, language),
    article_id: articleId(a.n),
    language,
    slug: t.slug,
    title: t.title,
    excerpt: t.excerpt,
    body: t.body,
    meta_title: null,
    meta_description: t.meta_description ?? null,
    og_image_path: null,
    created_at: daysAgo(a.created_days_ago),
    updated_at: daysAgo(a.updated_days_ago),
    ...deriveArticleMeta(t.body),
  };
}

export const HELP_TRANSLATIONS: HelpArticleTranslation[] = SEED_ARTICLES.flatMap((a) => [
  translation(a, "ar", a.ar),
  ...(a.en ? [translation(a, "en", a.en)] : []),
]);
