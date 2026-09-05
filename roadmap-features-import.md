# Roadmap Import — Flovoo Feature Batches (Shipped + In Progress)

> **For Claude Code — read this whole section before touching the database.**

## What exists today

- The public roadmap portal is live (same repo, same Supabase project as the help center) with three board columns — Under Review / Planned / In Progress — plus a "What's New" (الجديد) changelog page for shipped items.
- The live database already holds a small amount of **real customer data**: at least two features (one about reports/analytics with a customer vote), one customer submission, and two changelog entries. Do not delete or overwrite any of it.
- The changelog is being upgraded to accept rich formatting (Intercom News migration). If that work is mid-flight, do not touch changelog code here — only insert entries through the existing data path.

## What is required

Import two batches of features from the `items` list below, in one run:

- **Batch A — 19 shipped items** (`status: shipped`): appear under Shipped, and each one also gets a **draft** changelog entry.
- **Batch B — 14 in-progress items** (`status: in_progress`): appear in the In Progress column. **No changelog entries** for these.

## Rules

1. **Copy is final.** Import Arabic and English `title` and `description` exactly as written. Arabic intentionally keeps English product terms (WhatsApp, Quick Replies, CSV, N8N, Workflows) — do not translate them. The only exception is item `channel-access-for-members`, whose Arabic is marked `REVIEW`: import it, but flag it in the report.
2. **Dates.** Shipped items carry `shipped_at: TBD`. Ask Yousef for one date for Batch A (or per item) **before** importing. Never invent dates. In-progress items have no date.
3. **Categories.** Each item has a `category_suggestion`. Map to existing roadmap categories. If any suggestion has no match, **stop and list the missing ones** with a proposal (create vs. map to an existing one). Do not create categories silently. Create/confirm categories once, then use them for both batches.
4. **Duplicates — critical.** Before inserting anything, check every item (both batches) by title in either language against existing features **in any status**. For each match: do not insert; report it and propose keeping the existing item and updating its status/copy to match this file while **preserving its votes**. Wait for Yousef's decision on all matches before importing. `analytics-reporting-dashboard` is the most likely match.
5. **Changelog drafts (Batch A only):** title = item title; body = description; type/badge from `type` (`feature` → new, `improvement` → improvement, `mobile` → new with category "Mobile App"); state = **draft**. Yousef publishes from the admin.
6. **Ordering & pinning:** keep `order` within each batch so the board and changelog list items in this sequence. Pin nothing.
7. **Transaction:** the entire import (both batches) is one transaction. If anything fails, nothing is inserted. Expected result: 33 features (19 shipped + 14 in progress, minus confirmed duplicates) and 19 changelog drafts.

## Sequence

1. Read this file fully; parse the YAML.
2. Run the duplicate check and the category mapping. Report both. **Stop.**
3. After Yousef answers (duplicates, missing categories, Batch A date), run the import in one transaction.
4. Report counts, the `REVIEW` flag, and any schema field this file does not provide with the default you used.

---

## Items

```yaml
batches:
  A:
    status: shipped
    default_shipped_at: TBD   # Yousef to confirm
    changelog: draft
  B:
    status: in_progress
    changelog: none

items:

  # ═══════════════ BATCH A — SHIPPED (19) ═══════════════

  # ───────────── Features ─────────────

  - order: 1
    batch: A
    slug: multi-day-campaigns
    type: feature
    status: shipped
    shipped_at: TBD
    category_suggestion: Campaigns / الحملات
    title_en: Multi-Day Campaigns
    title_ar: الحملات متعددة الأيام
    description_en: >
      Campaigns can now run over multiple days for large audiences. Oversized
      campaigns can start immediately and continue automatically, users can see
      the expected completion date before sending, and the system prevents
      conflicting multi-day campaigns on the same WhatsApp account. Campaigns can
      also be paused, resumed, and recovered when interrupted.
    description_ar: >
      أصبحت الحملات قادرة على العمل على مدار عدة أيام عند استهداف جماهير كبيرة.
      يمكن بدء الحملات كبيرة الحجم ومواصلة إرسالها تلقائيًا، مع عرض تاريخ
      الإكمال المتوقع قبل الإرسال، ومنع تعارض حملتين متعددتي الأيام على نفس
      حساب WhatsApp، بالإضافة إلى إمكانية الإيقاف المؤقت والاستئناف والاستعادة
      عند حدوث انقطاع.

  - order: 2
    batch: A
    slug: blocked-contacts-spam-management
    type: feature
    status: shipped
    shipped_at: TBD
    category_suggestion: Contacts / جهات الاتصال
    title_en: Blocked Contacts & Spam Management
    title_ar: حظر جهات الاتصال وإدارة الرسائل المزعجة
    description_en: >
      Teams can now block unwanted contacts from reaching them through a
      dedicated Blocked Contacts capability, providing better control over
      unwanted or spam interactions.
    description_ar: >
      يمكن للفرق الآن حظر جهات الاتصال غير المرغوب فيها من الوصول إليها من خلال
      ميزة مخصصة لإدارة جهات الاتصال المحظورة، مما يوفر تحكمًا أفضل في التفاعلات
      غير المرغوب فيها والرسائل المزعجة.

  - order: 3
    batch: A
    slug: campaign-filter-for-contacts
    type: feature
    status: shipped
    shipped_at: TBD
    category_suggestion: Contacts / جهات الاتصال
    title_en: Campaign Filter for Contacts
    title_ar: فلتر الحملات لجهات الاتصال
    description_en: >
      Users can filter contacts by the specific campaign they were included in,
      making it easier to identify and review contacts targeted by a particular
      campaign.
    description_ar: >
      يمكن للمستخدمين الآن تصفية جهات الاتصال حسب الحملة التي تم استهدافهم من
      خلالها، مما يسهل تحديد ومراجعة جهات الاتصال المستهدفة بحملة معينة.

  - order: 4
    batch: A
    slug: voice-message-quick-replies
    type: feature
    status: shipped
    shipped_at: TBD
    category_suggestion: Inbox / صندوق الوارد
    title_en: Voice Message Quick Replies
    title_ar: الردود السريعة للرسائل الصوتية
    description_en: >
      Users can save and send voice messages as Quick Replies, extending Quick
      Replies beyond text messages and making frequently used voice responses
      easier to reuse.
    description_ar: >
      يمكن للمستخدمين حفظ وإرسال الرسائل الصوتية كـ Quick Replies، لتوسيع ميزة
      الردود السريعة لتشمل الرسائل الصوتية إلى جانب الرسائل النصية.

  - order: 5
    batch: A
    slug: request-contact-info-via-whatsapp
    type: feature
    status: shipped
    shipped_at: TBD
    category_suggestion: WhatsApp / واتساب
    title_en: Request Contact Information via WhatsApp
    title_ar: طلب معلومات الاتصال عبر WhatsApp
    description_en: >
      Agents can request a customer's phone number directly from a WhatsApp
      conversation using WhatsApp's native interactive message.
    description_ar: >
      يمكن للـAgents طلب رقم هاتف العميل مباشرة من محادثة WhatsApp باستخدام
      الرسالة التفاعلية الأصلية من WhatsApp.

  - order: 6
    batch: A
    slug: contacts-import-v2
    type: feature
    status: shipped
    shipped_at: TBD
    category_suggestion: Contacts / جهات الاتصال
    title_en: Contacts Import V2
    title_ar: استيراد جهات الاتصال V2
    description_en: >
      A redesigned Contacts Import experience allows users to import contacts
      directly from CSV files, map spreadsheet columns to Flovoo contact fields,
      and review skipped rows along with the reason they were not imported.
    description_ar: >
      تمت إعادة تصميم تجربة استيراد جهات الاتصال بحيث يمكن للمستخدمين استيراد
      جهات الاتصال مباشرة من ملفات CSV، وربط أعمدة جدول البيانات بحقول Flovoo،
      ومراجعة الصفوف التي تم تخطيها مع توضيح سبب عدم استيرادها.

  - order: 7
    batch: A
    slug: whatsapp-history-sync-v2
    type: feature
    status: shipped
    shipped_at: TBD
    category_suggestion: WhatsApp / واتساب
    title_en: WhatsApp History Sync V2
    title_ar: مزامنة سجل WhatsApp V2
    description_en: >
      A redesigned WhatsApp History Sync experience gives users more control over
      what they want to import when connecting a WhatsApp number. Users can
      choose to import all contacts and conversations, conversations with their
      contacts, or contacts only. The process also provides a clear sync summary
      showing imported contacts, imported conversations, completion date, and
      sync duration.
    description_ar: >
      تمت إعادة تصميم تجربة مزامنة سجل WhatsApp لتمنح المستخدمين تحكمًا أكبر في
      البيانات التي يريدون استيرادها عند ربط رقم WhatsApp بـFlovoo. يمكن
      للمستخدم اختيار استيراد جميع جهات الاتصال والمحادثات، أو المحادثات مع
      جهات الاتصال، أو جهات الاتصال فقط. كما تعرض العملية ملخصًا واضحًا لنتيجة
      المزامنة يتضمن عدد جهات الاتصال والمحادثات المستوردة وتاريخ الإكمال ومدة
      المزامنة.

  - order: 8
    batch: A
    slug: contact-sync-permissions
    type: feature
    status: shipped
    shipped_at: TBD
    category_suggestion: WhatsApp / واتساب
    title_en: Contact Sync Permissions
    title_ar: صلاحيات مزامنة جهات الاتصال
    description_en: >
      Each connected WhatsApp channel has dedicated Contact Sync Permissions,
      allowing organizations to control whether new contacts, contact edits, and
      contact removals are synchronized from WhatsApp to Flovoo.
    description_ar: >
      يحتوي كل WhatsApp Channel متصل الآن على إعدادات مخصصة لصلاحيات مزامنة جهات
      الاتصال، مما يسمح للمؤسسات بالتحكم في مزامنة إضافة جهات الاتصال وتعديلها
      وحذفها من WhatsApp إلى Flovoo.

  - order: 9
    batch: A
    slug: campaign-pricing-calculator
    type: feature
    status: shipped
    shipped_at: TBD
    category_suggestion: Campaigns / الحملات
    title_en: Campaign Pricing Calculator
    title_ar: حاسبة تكلفة الحملة
    description_en: >
      Users can estimate the expected cost of a campaign before sending it, based
      on audience size and message type.
    description_ar: >
      يمكن للمستخدمين الآن تقدير التكلفة المتوقعة للحملة قبل إرسالها، بناءً على
      حجم الجمهور ونوع الرسالة.

  - order: 10
    batch: A
    slug: channel-access-for-members
    type: feature
    status: shipped
    shipped_at: TBD
    category_suggestion: Team & Settings / الفريق والإعدادات
    review: "REVIEW — Arabic text drafted for this file; not in the original Arabic report."
    title_en: Channel Access for Members
    title_ar: صلاحيات الوصول إلى القنوات للأعضاء
    description_en: >
      Members can now be granted access to specific channels directly from their
      profile. Channel Access determines which channels and their associated
      conversations a member can access, while Owners and Admins have access to
      all channels by default.
    description_ar: >
      يمكن الآن منح الأعضاء صلاحية الوصول إلى قنوات محددة مباشرة من ملفهم
      الشخصي. تحدد صلاحية الوصول إلى القنوات (Channel Access) القنوات والمحادثات
      المرتبطة بها التي يمكن للعضو الوصول إليها، بينما يتمتع المالكون والمديرون
      (Owners وAdmins) بالوصول إلى جميع القنوات افتراضيًا.

  # ───────────── Improvements ─────────────

  - order: 11
    batch: A
    slug: contacts-page-enhancements
    type: improvement
    status: shipped
    shipped_at: TBD
    category_suggestion: Contacts / جهات الاتصال
    title_en: Contacts Page Enhancements
    title_ar: تحسينات صفحة جهات الاتصال
    description_en: >
      The Contacts experience has been enhanced with improved contact visibility
      and filtering. Usernames are now displayed as @username, Tag filtering is
      available directly from the Contacts toolbar, and users can filter contacts
      by campaign.
    description_ar: >
      تم تحسين تجربة جهات الاتصال من خلال تحسين عرض المعلومات والوصول إلى
      الفلاتر. تظهر أسماء المستخدمين الآن بصيغة @username، وأصبح فلتر Tags
      متاحًا مباشرة من شريط أدوات صفحة Contacts، كما يمكن تصفية جهات الاتصال
      حسب الحملة.

  - order: 12
    batch: A
    slug: campaign-creator-visibility
    type: improvement
    status: shipped
    shipped_at: TBD
    category_suggestion: Campaigns / الحملات
    title_en: Campaign Creator Visibility
    title_ar: إظهار منشئ الحملة
    description_en: >
      The Campaigns table now shows who created each campaign, making campaign
      ownership easier to identify.
    description_ar: >
      يعرض جدول الحملات الآن المستخدم الذي أنشأ كل حملة، مما يسهل تحديد مالك
      الحملة.

  - order: 13
    batch: A
    slug: whatsapp-template-delivery-rate
    type: improvement
    status: shipped
    shipped_at: TBD
    category_suggestion: WhatsApp / واتساب
    title_en: WhatsApp Template Delivery Rate
    title_ar: إظهار معدل تسليم قوالب WhatsApp
    description_en: >
      Template delivery performance is now visible directly in the Templates
      table, allowing users to quickly evaluate delivery rates without opening a
      separate report.
    description_ar: >
      أصبح معدل أداء تسليم كل قالب WhatsApp ظاهرًا مباشرة في جدول القوالب، مما
      يسمح للمستخدمين بتقييم معدلات التسليم بسرعة دون فتح تقرير منفصل.

  - order: 14
    batch: A
    slug: dedicated-help-support
    type: improvement
    status: shipped
    shipped_at: TBD
    category_suggestion: General / عام
    title_en: Dedicated Help & Support
    title_ar: صفحة مخصصة للمساعدة والدعم
    description_en: >
      Help & Support is available through a dedicated page, providing a clearer
      and more direct way for users to access support.
    description_ar: >
      أصبح Help & Support متاحًا من خلال صفحة مخصصة، مما يوفر طريقة أوضح وأكثر
      مباشرة للوصول إلى موارد الدعم.

  - order: 15
    batch: A
    slug: unread-count-on-chats
    type: improvement
    status: shipped
    shipped_at: TBD
    category_suggestion: Inbox / صندوق الوارد
    title_en: Unread Count on Chats
    title_ar: عداد الرسائل غير المقروءة في Chats
    description_en: >
      The Chats icon in the sidebar now displays an unread-count badge, allowing
      users to immediately see how many unread conversations require attention.
    description_ar: >
      يعرض رمز Chats في الشريط الجانبي الآن عدد المحادثات غير المقروءة، مما
      يساعد المستخدم على معرفة عدد المحادثات التي تحتاج إلى الانتباه.

  - order: 16
    batch: A
    slug: simplify-reply-access-assigned-contacts
    type: improvement
    status: shipped
    shipped_at: TBD
    category_suggestion: Inbox / صندوق الوارد
    title_en: Simplify Reply Access on Assigned Contacts
    title_ar: تبسيط الوصول إلى الرد للمحادثات المُسندة
    description_en: >
      The unnecessary Collaborate step has been removed. Agents can now reply to
      assigned conversations directly according to their existing role-based
      permissions, making the reply workflow simpler on both Web and Mobile.
    description_ar: >
      تمت إزالة خطوة Collaborate غير الضرورية. أصبح بإمكان الـAgents الرد على
      المحادثات المُسندة مباشرة وفقًا لصلاحيات الأدوار الحالية، مما يجعل عملية
      الرد أبسط على Web وMobile.

  # ───────────── Mobile App ─────────────

  - order: 17
    batch: A
    slug: mobile-sign-in-google-apple
    type: mobile
    status: shipped
    shipped_at: TBD
    category_suggestion: Mobile App / تطبيق الموبايل
    title_en: Sign in with Google & Apple
    title_ar: تسجيل الدخول باستخدام Google وApple
    description_en: >
      Users can sign in to the Flovoo mobile app using their Google or Apple
      account in addition to the standard login options.
    description_ar: >
      يمكن للمستخدمين تسجيل الدخول إلى تطبيق Flovoo على الموبايل باستخدام حساب
      Google أو Apple بالإضافة إلى خيارات تسجيل الدخول المعتادة.

  - order: 18
    batch: A
    slug: mobile-voice-note-pause-resume
    type: mobile
    status: shipped
    shipped_at: TBD
    category_suggestion: Mobile App / تطبيق الموبايل
    title_en: Voice Note Pause & Resume
    title_ar: إيقاف واستئناف تسجيل الرسائل الصوتية
    description_en: >
      Users can pause and resume voice-note recordings while recording, instead
      of having to continue, send, or delete the recording.
    description_ar: >
      يمكن للمستخدمين الآن إيقاف تسجيل الرسالة الصوتية مؤقتًا واستئنافه أثناء
      التسجيل، بدلًا من الاضطرار إلى الاستمرار أو الإرسال أو الحذف.

  - order: 19
    batch: A
    slug: mobile-contacts-archive-blocked-filter
    type: mobile
    status: shipped
    shipped_at: TBD
    category_suggestion: Mobile App / تطبيق الموبايل
    title_en: Archive / Unarchive / Blocked Contact Filter
    title_ar: فلتر Archived / Unarchived / Blocked لجهات الاتصال
    description_en: >
      The mobile Contacts list now includes a filter that allows users to quickly
      view Archived, Unarchived, or Blocked contacts.
    description_ar: >
      يحتوي تطبيق الموبايل الآن على فلتر في قائمة جهات الاتصال يتيح للمستخدمين
      عرض جهات الاتصال المؤرشفة أو غير المؤرشفة أو المحظورة بسرعة.

  # ═══════════════ BATCH B — IN PROGRESS (14) ═══════════════

  - order: 1
    batch: B
    slug: custom-contact-fields
    status: in_progress
    category_suggestion: Contacts / جهات الاتصال
    title_en: Custom Contact Fields
    title_ar: الحقول المخصصة لجهات الاتصال
    description_en: >
      Create and manage your own custom fields on contacts, with dedicated
      filters and views tailored to your business.
    description_ar: >
      إنشاء وإدارة حقول مخصصة لجهات الاتصال، مع فلاتر وطرق عرض مخصصة تتناسب مع
      احتياجات عملك.

  - order: 2
    batch: B
    slug: ai-agents
    status: in_progress
    category_suggestion: Automation / الأتمتة
    title_en: AI Agents
    title_ar: وكلاء الذكاء الاصطناعي
    description_en: >
      Automate conversations with AI-powered agents that can respond to
      customers on your behalf.
    description_ar: >
      أتمتة المحادثات باستخدام وكلاء مدعومين بالذكاء الاصطناعي يمكنهم الرد على
      العملاء نيابةً عنك.

  - order: 3
    batch: B
    slug: analytics-reporting-dashboard
    status: in_progress
    category_suggestion: Reports / التقارير
    duplicate_watch: "Likely matches the existing live roadmap item about reports/analytics — see rule 5."
    title_en: Analytics & Reporting Dashboard
    title_ar: لوحة التحليلات والتقارير
    description_en: >
      A new dashboard giving you insights and reports on your campaigns,
      conversations, and team performance.
    description_ar: >
      لوحة جديدة توفر رؤى وتقارير حول الحملات والمحادثات وأداء الفريق.

  - order: 4
    batch: B
    slug: auto-page-selection-facebook-instagram
    status: in_progress
    category_suggestion: Facebook & Instagram / فيسبوك وإنستغرام
    title_en: Automatic Page Selection for Facebook & Instagram
    title_ar: الاختيار التلقائي للصفحات على Facebook وInstagram
    description_en: >
      Newly connected and future Facebook/Instagram pages are automatically
      included — no manual setup needed.
    description_ar: >
      يتم تضمين صفحات Facebook وInstagram الجديدة التي يتم ربطها، وكذلك الصفحات
      المستقبلية، تلقائيًا دون الحاجة إلى إعداد يدوي.

  - order: 5
    batch: B
    slug: manage-replies-facebook-instagram-comments
    status: in_progress
    category_suggestion: Facebook & Instagram / فيسبوك وإنستغرام
    title_en: Manage Replies — Facebook & Instagram Comments
    title_ar: إدارة الردود — تعليقات Facebook وInstagram
    description_en: >
      Automatically reply to comments on your Facebook and Instagram posts,
      publicly or privately, with defaults for all posts or custom replies per
      post.
    description_ar: >
      الرد تلقائيًا على التعليقات على منشورات Facebook وInstagram بشكل عام أو
      خاص، مع إعدادات افتراضية لجميع المنشورات أو ردود مخصصة لكل منشور.

  - order: 6
    batch: B
    slug: n8n-integration
    status: in_progress
    category_suggestion: Integrations / التكاملات
    title_en: N8N Integration
    title_ar: تكامل N8N
    description_en: >
      Connect Flovoo to N8N to build custom automations with your other tools
      and workflows.
    description_ar: >
      ربط Flovoo مع N8N لبناء عمليات أتمتة مخصصة مع الأدوات وعمليات العمل
      الأخرى.

  - order: 7
    batch: B
    slug: public-api-access
    status: in_progress
    category_suggestion: Integrations / التكاملات
    title_en: Public API Access
    title_ar: الوصول إلى Public API
    description_en: >
      Open Flovoo APIs so you can integrate Flovoo with your own systems and
      external tools.
    description_ar: >
      إتاحة واجهات Flovoo البرمجية للتكامل مع الأنظمة الخاصة بك والأدوات
      الخارجية.

  - order: 8
    batch: B
    slug: whatsapp-widget
    status: in_progress
    category_suggestion: WhatsApp / واتساب
    title_en: WhatsApp Widget
    title_ar: WhatsApp Widget
    description_en: >
      Add a WhatsApp chat widget to your website so visitors can start a
      WhatsApp conversation with you directly.
    description_ar: >
      إضافة أداة محادثة WhatsApp إلى موقعك الإلكتروني حتى يتمكن الزوار من بدء
      محادثة عبر WhatsApp مباشرةً.

  - order: 9
    batch: B
    slug: member-online-offline-status
    status: in_progress
    category_suggestion: Team & Settings / الفريق والإعدادات
    title_en: Member Online/Offline Status
    title_ar: حالة الأعضاء Online / Offline
    description_en: >
      Admins and Owners can see which team members are currently online,
      helping manage availability and coverage.
    description_ar: >
      يمكن للـAdmins والـOwners معرفة أعضاء الفريق المتصلين حاليًا، مما يساعد في
      إدارة التوافر وتغطية العمل.

  - order: 10
    batch: B
    slug: notes-v2-mentions
    status: in_progress
    category_suggestion: Inbox / صندوق الوارد
    title_en: Notes Section V2 & Mentions
    title_ar: الإصدار الثاني من قسم الملاحظات والإشارات
    description_en: >
      An upgraded notes experience on conversations and contacts, with the
      ability to mention teammates directly.
    description_ar: >
      تجربة مطورة للملاحظات داخل المحادثات وجهات الاتصال، مع إمكانية الإشارة إلى
      أعضاء الفريق مباشرةً.

  - order: 11
    batch: B
    slug: in-app-notifications
    status: in_progress
    category_suggestion: General / عام
    title_en: In-App Notifications
    title_ar: الإشعارات داخل التطبيق
    description_en: >
      A dedicated notifications center inside Flovoo to keep your team updated
      in real time.
    description_ar: >
      مركز مخصص للإشعارات داخل Flovoo لإبقاء الفريق على اطلاع بالتحديثات في
      الوقت الفعلي.

  - order: 12
    batch: B
    slug: whatsapp-groups
    status: in_progress
    category_suggestion: WhatsApp / واتساب
    title_en: WhatsApp Groups
    title_ar: مجموعات WhatsApp
    description_en: >
      Manage and message WhatsApp Groups directly from Flovoo.
    description_ar: >
      إدارة مجموعات WhatsApp وإرسال الرسائل إليها مباشرةً من خلال Flovoo.

  - order: 13
    batch: B
    slug: whatsapp-calling-api
    status: in_progress
    category_suggestion: WhatsApp / واتساب
    title_en: WhatsApp Calling API
    title_ar: WhatsApp Calling API
    description_en: >
      Enable WhatsApp voice calling so customers can call your business number
      directly through WhatsApp.
    description_ar: >
      تفعيل المكالمات الصوتية عبر WhatsApp حتى يتمكن العملاء من الاتصال برقم
      نشاطك التجاري مباشرةً من خلال WhatsApp.

  - order: 14
    batch: B
    slug: workflows
    status: in_progress
    category_suggestion: Automation / الأتمتة
    title_en: Workflows
    title_ar: سير العمل الآلي (Workflows)
    description_en: >
      Build automated workflows that trigger actions based on customer behavior
      and conversation events.
    description_ar: >
      إنشاء عمليات عمل مؤتمتة تقوم بتشغيل إجراءات تلقائيًا بناءً على سلوك
      العملاء وأحداث المحادثات.
```

---

## Expected report from Claude Code

**Before importing:**
- Duplicate matches (any status) with a proposal per match.
- Category mapping table (suggestion → existing category, or "missing" with a proposal).
- Confirmation that a Batch A date is needed.

**After importing:**
- Features inserted: shipped / in progress counts (minus confirmed duplicates).
- 19 changelog drafts created for Batch A, none for Batch B.
- `channel-access-for-members` flagged for Arabic review.
- Any schema field not covered by this file and the default used.
