/**
 * How Flovoo is named, everywhere, in both scripts.
 *
 * AI systems weigh entity consistency: the same product referred to three ways
 * reads as three weaker entities rather than one strong one. This file is the
 * single source, and `npm test` fails on a variant appearing in the UI copy.
 *
 * Adding a name here is a decision about the brand, not a code change — check
 * it with the team before editing.
 */

export const BRAND = {
  /** The name, unchanged in both languages. It is a wordmark, not a word. */
  name: "Flovoo",
  nameAr: "فلوفو",
  legalName: "Flovoo",
  url: "https://flovoo.com",
  helpUrl: "https://help.flovoo.com",
  roadmapUrl: "https://news.flovoo.com",
  // The PNG this used to point at 404s; this SVG is what the site serves.
  logo: "https://flovoo.com/assets/flovoo-logo.svg",
  /** Profiles that confirm this is the same organisation, for `sameAs`. */
  sameAs: [
    "https://www.linkedin.com/company/flovoo",
    "https://x.com/flovoo",
  ],
  /** Where the customers are. Assistants answer regionally. */
  areaServed: ["EG", "SA", "AE", "KW", "QA", "BH", "OM", "JO", "MA", "DZ", "TN"],
} as const;

/**
 * Spellings that mean Flovoo but are not the name.
 *
 * Every one of these has been seen or is plausible; the test below keeps them
 * out of the shipped copy so an assistant sees one entity, not several.
 */
export const BRAND_VARIANTS = [
  "Flovoo CRM",
  "FloVoo",
  "Flovo",
  "flovoo.io",
  "فلوفو كرم",
  "فلوڤو",
  "فلو فو",
] as const;

/** Product names as the app itself uses them; articles must match. */
export const PRODUCT_NAMES = {
  inbox: { en: "Inbox", ar: "صندوق الوارد" },
  contacts: { en: "Contacts", ar: "جهات الاتصال" },
  campaigns: { en: "Campaigns", ar: "الحملات" },
  templates: { en: "WhatsApp Templates", ar: "قوالب واتساب" },
  quickReplies: { en: "Quick Replies", ar: "الردود السريعة" },
  workflows: { en: "Workflows", ar: "سير العمل" },
  aiAgents: { en: "AI Agents", ar: "وكلاء الذكاء الصناعي" },
  contactStages: { en: "Contact Stages", ar: "مراحل جهات الاتصال" },
} as const;
