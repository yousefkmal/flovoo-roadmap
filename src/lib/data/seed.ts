import type { Category, ChangelogEntry, Feature } from "@/lib/types";

/**
 * Seed content for local development. Mirrors `supabase/seed.sql` — keep the two
 * in sync. Once `NEXT_PUBLIC_SUPABASE_URL` is set the repository reads from
 * Supabase instead and this file is only used for tests and offline work.
 */

const now = new Date("2026-09-02T09:00:00Z");
const daysAgo = (n: number) =>
  new Date(now.getTime() - n * 86_400_000).toISOString();

export const CATEGORIES: Category[] = [
  {
    id: "c1000000-0000-4000-8000-000000000001",
    slug: "whatsapp",
    name_ar: "واتساب",
    name_en: "WhatsApp",
    color: "#25D366",
    sort_order: 1,
  },
  {
    id: "c1000000-0000-4000-8000-000000000002",
    slug: "inbox",
    name_ar: "صندوق الوارد",
    name_en: "Inbox",
    color: "#4D6BFB",
    sort_order: 2,
  },
  {
    id: "c1000000-0000-4000-8000-000000000003",
    slug: "automation",
    name_ar: "الأتمتة",
    name_en: "Automation",
    color: "#7A5AF8",
    sort_order: 3,
  },
  {
    id: "c1000000-0000-4000-8000-000000000004",
    slug: "reports",
    name_ar: "التقارير",
    name_en: "Reports",
    color: "#2EA8FF",
    sort_order: 4,
  },
  {
    id: "c1000000-0000-4000-8000-000000000005",
    slug: "mobile",
    name_ar: "تطبيق الجوال",
    name_en: "Mobile App",
    color: "#F79009",
    sort_order: 5,
  },
];

const [WHATSAPP, INBOX, AUTOMATION, REPORTS, MOBILE] = CATEGORIES.map((c) => c.id);

type SeedFeature = Omit<Feature, "updated_at"> & { updated_at?: string };

const features: SeedFeature[] = [
  // ── In progress ──────────────────────────────────────────────────────────
  {
    id: "f1000000-0000-4000-8000-000000000001",
    title_ar: "ردود جاهزة بالذكاء الاصطناعي",
    title_en: "AI-suggested replies",
    description_ar:
      "اقتراحات فورية للرد على العميل بناءً على سياق المحادثة ونبرة علامتك التجارية، مع إمكانية تعديلها قبل الإرسال.",
    description_en:
      "Instant reply suggestions based on the conversation context and your brand tone, editable before you send.",
    status: "in_progress",
    category_id: AUTOMATION,
    vote_count: 218,
    is_pinned: true,
    source: "internal",
    submitted_by_name: null,
    shipped_at: null,
    created_at: daysAgo(62),
  },
  {
    id: "f1000000-0000-4000-8000-000000000002",
    title_ar: "توزيع المحادثات تلقائيًا على الفريق",
    title_en: "Automatic conversation routing",
    description_ar:
      "وزّع المحادثات الواردة على أعضاء الفريق حسب التخصص أو ساعات العمل أو حجم العمل الحالي، دون إسناد يدوي.",
    description_en:
      "Route incoming conversations to teammates by skill, working hours, or current load — no manual assignment.",
    status: "in_progress",
    category_id: INBOX,
    vote_count: 176,
    is_pinned: false,
    source: "internal",
    submitted_by_name: null,
    shipped_at: null,
    created_at: daysAgo(48),
  },
  {
    id: "f1000000-0000-4000-8000-000000000003",
    title_ar: "كتالوج المنتجات داخل واتساب",
    title_en: "Product catalog inside WhatsApp",
    description_ar:
      "اعرض منتجاتك وأسعارها داخل المحادثة، ليضيفها العميل إلى السلة دون مغادرة واتساب.",
    description_en:
      "Show products and prices inside the chat so customers can add to cart without leaving WhatsApp.",
    status: "in_progress",
    category_id: WHATSAPP,
    vote_count: 143,
    is_pinned: false,
    source: "customer_submission",
    submitted_by_name: "متجر رفوف",
    shipped_at: null,
    created_at: daysAgo(35),
  },
  {
    id: "f1000000-0000-4000-8000-000000000004",
    title_ar: "إشعارات فورية على تطبيق الجوال",
    title_en: "Push notifications on mobile",
    description_ar:
      "إشعار فوري على هاتفك لكل محادثة جديدة أو إسناد جديد، مع إمكانية الرد من داخل الإشعار.",
    description_en:
      "Get an instant push for every new conversation or assignment, and reply straight from the notification.",
    status: "in_progress",
    category_id: MOBILE,
    vote_count: 97,
    is_pinned: false,
    source: "internal",
    submitted_by_name: null,
    shipped_at: null,
    created_at: daysAgo(21),
  },

  // ── Planned ──────────────────────────────────────────────────────────────
  {
    id: "f1000000-0000-4000-8000-000000000005",
    title_ar: "لوحة تحليلات لأداء الفريق",
    title_en: "Team performance analytics",
    description_ar:
      "متوسط زمن الرد وعدد المحادثات المغلقة ورضا العملاء لكل موظف، في لوحة واحدة قابلة للتصدير.",
    description_en:
      "Average response time, resolved conversations, and CSAT per agent — one exportable dashboard.",
    status: "planned",
    category_id: REPORTS,
    vote_count: 189,
    is_pinned: true,
    source: "internal",
    submitted_by_name: null,
    shipped_at: null,
    created_at: daysAgo(54),
  },
  {
    id: "f1000000-0000-4000-8000-000000000006",
    title_ar: "قوالب رسائل واتساب متعددة اللغات",
    title_en: "Multilingual WhatsApp templates",
    description_ar:
      "أنشئ القالب مرة واحدة بالعربية والإنجليزية، ويختار فلوفو اللغة المناسبة حسب لغة العميل.",
    description_en:
      "Write a template once in Arabic and English; Flovoo picks the right one based on the customer's language.",
    status: "planned",
    category_id: WHATSAPP,
    vote_count: 134,
    is_pinned: false,
    source: "internal",
    submitted_by_name: null,
    shipped_at: null,
    created_at: daysAgo(40),
  },
  {
    id: "f1000000-0000-4000-8000-000000000007",
    title_ar: "ملاحظات داخلية على المحادثة",
    title_en: "Internal notes on conversations",
    description_ar:
      "اكتب ملاحظة يراها فريقك وحده، واذكر زميلك بعلامة @ لضمّه إلى المحادثة.",
    description_en:
      "Leave a note only your team can see, and @-mention a teammate to pull them into the conversation.",
    status: "planned",
    category_id: INBOX,
    vote_count: 121,
    is_pinned: false,
    source: "customer_submission",
    submitted_by_name: "عيادات نبض",
    shipped_at: null,
    created_at: daysAgo(28),
  },
  {
    id: "f1000000-0000-4000-8000-000000000008",
    title_ar: "تقارير مجدولة على البريد",
    title_en: "Scheduled email reports",
    description_ar:
      "استقبل ملخص أداء أسبوعيًا أو شهريًا على بريدك تلقائيًا، دون فتح لوحة التقارير.",
    description_en:
      "Receive a weekly or monthly performance summary by email automatically — no need to open the dashboard.",
    status: "planned",
    category_id: REPORTS,
    vote_count: 76,
    is_pinned: false,
    source: "internal",
    submitted_by_name: null,
    shipped_at: null,
    created_at: daysAgo(31),
  },

  // ── Under review ─────────────────────────────────────────────────────────
  {
    id: "f1000000-0000-4000-8000-000000000009",
    title_ar: "دعم قناة تيك توك للرسائل",
    title_en: "TikTok messaging channel",
    description_ar:
      "اجمع رسائل تيك توك في صندوق الوارد نفسه مع بقية القنوات، حتى لا يفوتك عميل.",
    description_en:
      "Bring TikTok messages into the same inbox as your other channels so no customer slips through.",
    status: "under_review",
    category_id: INBOX,
    vote_count: 158,
    is_pinned: true,
    source: "customer_submission",
    submitted_by_name: "Nour A.",
    shipped_at: null,
    created_at: daysAgo(11),
  },
  {
    id: "f1000000-0000-4000-8000-000000000010",
    title_ar: "روبوت حجز المواعيد",
    title_en: "Appointment booking bot",
    description_ar:
      "دع العميل يحجز موعده بنفسه داخل المحادثة، ليُسجَّل مباشرة في تقويم فريقك.",
    description_en:
      "Let customers book their own slot inside the chat, and have it land straight in your team calendar.",
    status: "under_review",
    category_id: AUTOMATION,
    vote_count: 112,
    is_pinned: false,
    source: "customer_submission",
    submitted_by_name: "صالون لمسة",
    shipped_at: null,
    created_at: daysAgo(6),
  },
  {
    id: "f1000000-0000-4000-8000-000000000011",
    title_ar: "الوضع الليلي في التطبيق",
    title_en: "Dark mode",
    description_ar: "وضع ليلي مريح للعين لفرق الدعم التي تعمل في الورديات المسائية.",
    description_en:
      "An easy-on-the-eyes dark theme for support teams working evening shifts.",
    status: "under_review",
    category_id: MOBILE,
    vote_count: 88,
    is_pinned: false,
    source: "customer_submission",
    submitted_by_name: "Hassan M.",
    shipped_at: null,
    created_at: daysAgo(22),
  },
  {
    id: "f1000000-0000-4000-8000-000000000012",
    title_ar: "بحث ذكي داخل كل المحادثات",
    title_en: "Smart search across conversations",
    description_ar:
      "ابحث بالمعنى لا بالكلمة الحرفية، مع تصفية حسب القناة أو الموظف أو الفترة الزمنية.",
    description_en:
      "Search by meaning rather than exact wording, with filters for channel, agent, and date range.",
    status: "under_review",
    category_id: INBOX,
    vote_count: 64,
    is_pinned: false,
    source: "internal",
    submitted_by_name: null,
    shipped_at: null,
    created_at: daysAgo(2),
  },
  {
    id: "f1000000-0000-4000-8000-000000000013",
    title_ar: "تصدير المحادثات إلى ملف",
    title_en: "Export conversations to a file",
    description_ar:
      "نزّل أرشيف محادثاتك بصيغة CSV أو PDF للمراجعة أو الأرشفة الداخلية.",
    description_en:
      "Download your conversation archive as CSV or PDF for review or internal record-keeping.",
    status: "under_review",
    category_id: REPORTS,
    vote_count: 41,
    is_pinned: false,
    source: "customer_submission",
    submitted_by_name: "شركة مدار",
    shipped_at: null,
    created_at: daysAgo(1),
  },

  // ── Shipped (lives on the changelog, not the board) ───────────────────────
  {
    id: "f1000000-0000-4000-8000-000000000014",
    title_ar: "الرد السريع بالاختصارات",
    title_en: "Saved replies with shortcuts",
    description_ar:
      "احفظ ردودك المتكررة واستدعها باختصار قصير أثناء الكتابة.",
    description_en:
      "Save your repeated answers and recall them with a short shortcut while typing.",
    status: "shipped",
    category_id: INBOX,
    vote_count: 204,
    is_pinned: false,
    source: "internal",
    submitted_by_name: null,
    shipped_at: daysAgo(18),
    created_at: daysAgo(120),
  },
  {
    id: "f1000000-0000-4000-8000-000000000015",
    title_ar: "ربط إنستغرام دايركت",
    title_en: "Instagram Direct integration",
    description_ar:
      "رسائل إنستغرام المباشرة والتعليقات أصبحت داخل صندوق وارد فلوفو مع بقية القنوات.",
    description_en:
      "Instagram Direct messages and comments now land in the Flovoo inbox alongside your other channels.",
    status: "shipped",
    category_id: WHATSAPP,
    vote_count: 167,
    is_pinned: false,
    source: "internal",
    submitted_by_name: null,
    shipped_at: daysAgo(46),
    created_at: daysAgo(150),
  },
  {
    id: "f1000000-0000-4000-8000-000000000016",
    title_ar: "تعدد المستخدمين والصلاحيات",
    title_en: "Team seats and permissions",
    description_ar:
      "أضف فريقك بأدوار مختلفة — مدير، موظف دعم، مراقب — ويرى كل عضو ما يخصه وحده.",
    description_en:
      "Add your team with distinct roles — admin, agent, viewer — so everyone sees only what concerns them.",
    status: "shipped",
    category_id: INBOX,
    vote_count: 131,
    is_pinned: false,
    source: "internal",
    submitted_by_name: null,
    shipped_at: daysAgo(75),
    created_at: daysAgo(190),
  },

  // ── Archived (must never reach the public board) ──────────────────────────
  {
    id: "f1000000-0000-4000-8000-000000000017",
    title_ar: "دعم قناة فايبر",
    title_en: "Viber channel support",
    description_ar: "مدمجة في طلب أوسع لدعم القنوات الإقليمية.",
    description_en: "Merged into a broader request for regional channel support.",
    status: "archived",
    category_id: INBOX,
    vote_count: 12,
    is_pinned: false,
    source: "customer_submission",
    submitted_by_name: "Karim S.",
    shipped_at: null,
    created_at: daysAgo(95),
  },
];

export const FEATURES: Feature[] = features.map((f) => ({
  ...f,
  updated_at: f.updated_at ?? f.created_at,
}));

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    id: "e1000000-0000-4000-8000-000000000001",
    feature_id: "f1000000-0000-4000-8000-000000000014",
    kind: "new",
    title_ar: "أطلقنا الرد السريع بالاختصارات",
    title_en: "Saved replies with shortcuts are live",
    body_ar:
      "احفظ ردودك المتكررة واستدعها بكتابة «/» متبوعة باختصار قصير. يوفّر ذلك على فرق الدعم آلاف الضغطات أسبوعيًا.\n\nيمكنك إنشاء الردود من الإعدادات ومشاركتها مع الفريق كله أو إبقاؤها خاصة بك. الردود تدعم المتغيرات، فيمكنك إدراج اسم العميل أو رقم الطلب تلقائيًا داخل النص.\n\nوإذا كان لديك أكثر من لغة، أنشئ نسخة عربية وأخرى إنجليزية للاختصار نفسه، وسيختار فلوفو المناسبة حسب لغة المحادثة.",
    body_en:
      "Save your repeated answers and recall them by typing “/” plus a short shortcut. Thousands of keystrokes saved per week.\n\nCreate replies from settings and share them with the whole team or keep them to yourself. Replies support variables, so a customer's name or an order number can be dropped into the text automatically.\n\nIf you work in more than one language, write an Arabic and an English version of the same shortcut and Flovoo picks the right one for the conversation.",
    image_url: "/updates/saved-replies.svg",
    image_alt_ar:
      "قائمة ردود محفوظة تظهر فوق مربع الكتابة، وبجانبه زر الاختصار «/».",
    image_alt_en:
      "A list of saved replies appearing above the composer, next to the “/” shortcut key.",
    article_url: "https://help.flovoo.com/ar/saved-replies",
    action_url: "https://app.flovoo.com/settings/saved-replies",
    action_label_ar: "افتح الردود المحفوظة",
    action_label_en: "Open saved replies",
    is_published: true,
    published_at: daysAgo(18),
  },
  {
    id: "e1000000-0000-4000-8000-000000000002",
    feature_id: "f1000000-0000-4000-8000-000000000015",
    kind: "new",
    title_ar: "إنستغرام المباشر وصل إلى صندوق الوارد",
    title_en: "Instagram Direct has landed in your inbox",
    body_ar:
      "الرسائل المباشرة والتعليقات أصبحت في المكان نفسه مع واتساب وماسنجر والرسائل النصية.\n\nاربط حسابك من صفحة القنوات، وستبدأ الرسائل بالوصول خلال دقائق. التعليقات على منشوراتك تظهر كمحادثات أيضًا، فيمكن لفريقك الرد عليها ثم متابعة الحديث في الخاص دون مغادرة فلوفو.",
    body_en:
      "Direct messages and comments now sit alongside WhatsApp, Messenger, and SMS in one place.\n\nConnect your account from the channels page and messages start arriving within minutes. Comments on your posts show up as conversations too, so your team can reply and then continue in DMs without leaving Flovoo.",
    image_url: "/updates/instagram-inbox.svg",
    image_alt_ar:
      "أربع قنوات على اليمين تتجمع خطوطها في صندوق وارد واحد على اليسار.",
    image_alt_en:
      "Four channels on one side, their lines converging into a single inbox on the other.",
    article_url: null,
    action_url: "https://app.flovoo.com/settings/channels",
    action_label_ar: "اربط إنستغرام",
    action_label_en: "Connect Instagram",
    is_published: true,
    published_at: daysAgo(46),
  },
  {
    id: "e1000000-0000-4000-8000-000000000003",
    feature_id: "f1000000-0000-4000-8000-000000000016",
    kind: "improved",
    title_ar: "أدوار وصلاحيات لفريقك بالكامل",
    title_en: "Roles and permissions for your whole team",
    body_ar:
      "أضف زملاءك بأدوار مختلفة، وحدّد بدقة من يرى ماذا ومن يمكنه الرد على من.\n\nثلاثة أدوار جاهزة: مدير يرى كل شيء، وموظف دعم يرى المحادثات المسندة إليه وفريقه، ومراقب يقرأ دون أن يرد. يمكنك تغيير دور أي عضو في أي وقت دون التأثير على المحادثات الجارية.",
    body_en:
      "Invite colleagues with distinct roles and control exactly who sees what and who can reply to whom.\n\nThree roles out of the box: an admin who sees everything, an agent who sees their own and their team's conversations, and a viewer who reads without replying. Change anyone's role at any time without disturbing conversations in flight.",
    image_url: "/updates/roles-permissions.svg",
    image_alt_ar:
      "ثلاث بطاقات أدوار، كل واحدة تعرض عدداً أقل من الصلاحيات المفعّلة من التي قبلها.",
    image_alt_en:
      "Three role cards, each showing fewer enabled permissions than the one before it.",
    article_url: "https://help.flovoo.com/ar/roles-and-permissions",
    action_url: null,
    action_label_ar: null,
    action_label_en: null,
    is_published: true,
    published_at: daysAgo(75),
  },
];
