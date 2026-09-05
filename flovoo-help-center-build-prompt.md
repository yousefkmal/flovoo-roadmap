# Flovoo Help Center — Build Prompt

> **How to use this file:** Share this entire document with Claude Code as the build brief. It contains full context, architecture, data model, screen specs, SEO plan, analytics requirements, and acceptance criteria. **Build one phase at a time and stop for review after each phase.** Do not skip ahead.

---

## 1. Context

You are building an **in-house, bilingual (Arabic-first) Help Center** for **Flovoo** — an Arabic-first unified customer conversation SaaS platform for SMBs in the MENA region (WhatsApp, Instagram, Messenger, SMS, and live chat in one inbox).

**Why this exists:** Flovoo is dropping Intercom entirely. The help center replaces Intercom's Articles product and becomes:
1. The **self-serve support surface** for customers (`help.flovoo.com`).
2. The **knowledge base that feeds Flovoo's AI Agent** (RAG over the same articles — this is a first-class requirement, not an afterthought).
3. An **SEO asset** that ranks for Arabic support/how-to queries in the MENA market.

**Existing ecosystem (must integrate, not duplicate):** Flovoo already runs a live public roadmap portal (`roadmap.flovoo.com`) built on the same intended stack. The help center shares:
- The **same Supabase project** (Postgres + Auth + Storage + RLS).
- The **same monorepo** and deployment pipeline (Vercel).
- The **same admin dashboard shell** — the roadmap admin gains a new "Help Center" section; do NOT build a second separate admin app or a second auth system.
- The **same design system** (tokens in §10).

**Audience reality check:** The typical reader is an SMB owner or a customer-service employee — **not a developer**. Most readers will land directly on an article page (from a link sent by support, the AI Agent, or Google), not by browsing. Article-page quality matters more than homepage quality.

---

## 2. Product Vision & Style Direction

**Explicit direction: it must NOT look or feel like Intercom's help center.** The agreed style is a hybrid:

- **Homepage & navigation structure → Featurebase-style:** clean hero with one large centered search bar, a small set of category cards with icons underneath, popular articles list. Simple, calm, zero clutter. No deep sidebar tree on the homepage.
- **Article page → Mintlify-style reading experience:** persistent on-page table of contents (side rail), comfortable typography, generous whitespace, first-class images/video, previous/next navigation, "Was this helpful?" at the end, breadcrumbs at the top.
- **Brand → 100% Flovoo design system** (§10). The result should feel like a natural sibling of the roadmap portal.

**Content is visual-first:** MENA SMB users strongly prefer screenshots and short videos over long text. The article format must treat images, annotated screenshots, embedded video, callouts, and step lists as primary content blocks — not afterthoughts.

**Tone of all customer-facing Arabic copy: simplified Modern Standard Arabic (فصحى مبسطة) only — no local dialects.** Warm, direct, verbs first, no exclamation marks in UI. English technical terms may appear in parentheses at first mention (e.g., "صندوق الوارد (Inbox)").

---

## 3. Scope

### In scope (v1)
- Public help center: home, category pages, article pages, search, 404/fallback
- Bilingual AR (default, RTL) / EN (LTR) with per-article language versions
- Hybrid search built for Arabic (see §6 — this is a hard requirement)
- Admin: article editor (bilingual), category manager, media library, redirects manager, analytics dashboard
- Full SEO layer (§8): SSR/SSG, meta control, hreflang, sitemaps, structured data, 301 redirects from Intercom
- Analytics & reporting (§9): views, search analytics, helpfulness, content-gap signals
- RAG-readiness (§7): article embeddings + a clean read API for the AI Agent
- Intercom content migration path (§11)

### Out of scope (v1 — design the schema to allow later, but do NOT build)
- In-app help widget / article suggestions inside the Flovoo app
- Multi-language beyond AR/EN
- Article version history UI (store `updated_at` + keep schema versionable)
- Community/comments on articles
- Gated/customer-only articles (all public in v1)

---

## 4. Users & Stories

### Visitor (customer or prospect — no login)
- Search in Arabic with tolerant matching (typos, with/without "ال", with/without hamza variants) and get relevant results.
- Browse a small set of clear categories (e.g., ابدأ من هنا، واتساب، صندوق الوارد، الأتمتة، الحملات، الفوترة والاشتراك).
- Read an article comfortably on mobile: sticky TOC (collapsible on mobile), copyable steps, zoomable screenshots, embedded video.
- Rate an article (مفيد / غير مفيد + optional short comment on "غير مفيد").
- Switch language; if the article exists in the other language, go to its counterpart; if not, show a graceful notice and the closest category.
- Hit a dead end → clear escalation card: "لم تجد ما تبحث عنه؟ تواصل معنا" linking to Flovoo's own live chat / WhatsApp (never Intercom).

### Admin / content editor (Flovoo team — existing admin auth)
- Create/edit articles with AR and EN versions in one editor (tabbed or side-by-side), each with its own slug, meta title, meta description.
- Rich block-based content: headings (auto-anchored for TOC), paragraphs, ordered steps, callouts (info/warning/tip), images with captions, video embeds, tables, accordions/FAQ blocks, code/inline-LTR spans for IDs and numbers.
- Draft → Publish workflow; unpublish; pin "popular" articles; reorder categories and articles.
- Manage redirects (source path → destination) with hit counters.
- Upload media to a library (Supabase Storage) with alt text per language.
- See the analytics dashboard (§9) and a **content-gap inbox**: zero-result search queries + "not helpful" feedback, each dismissible or convertible into a draft article.

### AI Agent (machine consumer)
- On publish/update, article content is chunked and embedded into pgvector automatically.
- A read-only endpoint/view exposes published articles (id, language, title, plain-text/markdown body, url, updated_at) for RAG retrieval — stable contract, documented in the repo README.

---

## 5. Architecture & Data Model

Extend the existing Supabase project. Suggested schema (adapt names to existing conventions in the repo):

```
collections (categories)
  id, slug, name_ar, name_en, description_ar, description_en,
  icon (Lucide name), sort_order, is_published

articles
  id            uuid pk
  collection_id fk
  status        enum: draft | published | archived
  is_pinned     bool                      -- "popular" on home
  sort_order    int
  created_at / updated_at / published_at

article_translations
  id, article_id fk, language ('ar'|'en'),
  slug          text unique per language  -- localized slugs, AR slugs allowed
  title, excerpt,
  body          jsonb                     -- block-based content
  body_plain    text                      -- generated: for search + RAG
  meta_title, meta_description,
  og_image_path nullable,
  toc           jsonb generated from headings,
  reading_minutes int,
  updated_at
  unique (article_id, language)

article_chunks                            -- RAG
  id, article_id, language, chunk_index, content text,
  embedding vector(1536), updated_at
  -- refreshed by trigger/edge function on publish/update

article_feedback
  id, article_id, language, is_helpful bool,
  comment text nullable, visitor_hash, created_at

article_views
  id, article_id, language, viewed_at, referrer_domain nullable,
  session_hash                            -- privacy-light, no PII

search_queries
  id, query text, language, results_count int,
  clicked_article_id nullable, created_at

redirects
  id, source_path text unique, target_path text,
  status_code int default 301, hits int default 0, created_at

media
  id, storage_path, alt_ar, alt_en, width, height, created_at
```

**Rules:**
- RLS: anonymous read = published content only; `article_feedback`, `search_queries`, `article_views` accept anonymous inserts with rate limiting; everything else admin-only.
- `body_plain` and `toc` regenerate automatically on save (DB trigger or server action) — never hand-maintained.
- The public site must render via **SSR/SSG with ISR** (Next.js App Router) — client-only rendering is forbidden because of SEO (§8).

---

## 6. Search — built for Arabic (hard requirement)

Default Postgres full-text search performs poorly on Arabic (diacritics, hamza variants أ/إ/آ/ا, ta marbuta ة/ه, definite article ال). Do NOT ship default FTS alone.

Implement **hybrid search**:

1. **Normalization layer** (applied to both indexed text and incoming queries): strip diacritics, unify hamza forms to ا, unify ى/ي and ة/ه, remove tatweel, optionally strip leading "ال".
2. **Lexical:** `pg_trgm` similarity over normalized `title + excerpt + body_plain` — catches typos and partial words.
3. **Semantic:** pgvector similarity over `article_chunks` embeddings — catches "المقصود" queries phrased differently from the article.
4. **Merge & rank:** weighted merge (title matches boosted), return top results with highlighted snippets; instant results dropdown as the user types (debounced), full results page on Enter.
5. **Log everything** into `search_queries`, especially zero-result queries — they feed the content-gap inbox.

English search uses the same pipeline minus the Arabic normalizer.

---

## 7. RAG / AI Agent readiness

- On article publish or update: an edge function (or server action) chunks `body_plain` (~500-token chunks with overlap), generates embeddings, and upserts `article_chunks`. On unpublish/archive: chunks are deleted.
- Expose a documented, versioned read contract for the AI Agent (Postgres view or REST endpoint): published articles + chunks with public URLs, so agent answers can cite "اقرأ المزيد" links.
- Keep the embedding model configurable via env var; record the model name per chunk so re-embedding after a model change is a targeted job, not guesswork.

---

## 8. SEO (first-class requirement)

1. **Rendering:** SSG/ISR for all public pages. Lighthouse SEO ≥ 95, LCP < 2.5s on mid-range mobile.
2. **URLs:** clean localized slugs — `/ar/مقالات/ربط-واتساب` style is allowed (properly encoded), or `/ar/articles/{slug}` with Arabic slugs; EN mirrors with `/en/...`. No query-string routing.
3. **hreflang:** every article/category page emits `hreflang` pairs (ar ↔ en) + `x-default`; language-switch links are real `<a>` links.
4. **Meta:** per-translation meta title/description editable in admin, with sane auto-fallbacks; canonical tags; OG + Twitter cards with an auto-generated branded OG image (article title over Flovoo gradient) when none is uploaded.
5. **Structured data (JSON-LD):** `Article` (or `TechArticle`) on articles, `BreadcrumbList` everywhere, `FAQPage` on articles that use FAQ blocks.
6. **Sitemaps:** auto-generated `sitemap.xml` split by language, referenced in `robots.txt`; regenerate on publish.
7. **Redirects from Intercom:** the `redirects` table is served via middleware (301). Admin can bulk-import a CSV map (old Intercom article URL path → new path). Unknown old paths fall back to the help home with the search prefilled from the old slug.
8. **Internal linking:** related-articles block at the end of each article (same collection + embedding similarity), and the roadmap portal + main site footer link to the help center.
9. **Media SEO:** enforced alt text per language, lazy loading, next-gen formats via the image pipeline.

---

## 9. Analytics & Reporting (admin dashboard)

Privacy-light, first-party only (no third-party trackers in v1; no PII — hashed session ids).

**Dashboard cards:**
- Views: total + trend (7/30/90 days), top articles, views by language (AR vs EN split — informs where to invest content).
- Search: top queries, **zero-result queries** (ranked by frequency), search→click-through rate.
- Helpfulness: helpful % per article, worst-performing articles (high views + low helpful %), recent "not helpful" comments.
- Content-gap inbox (§4): actionable list combining zero-result queries + negative feedback; each item → dismiss or "create draft from this".
- Redirect health: top hit redirects, 404s on unknown paths.

Keep the implementation simple: plain SQL aggregates over the event tables with date filters — no external analytics service.

---

## 10. Design System (Flovoo DS v1.1 — apply exactly, no substitutes)

- **Colors:** gradient `linear-gradient(135deg, #2EA8FF → #4D6BFB → #7A5AF8)` — reserved for primary CTA and brand surfaces only, never body text. Sky Blue `#2EA8FF`; Flovoo Blue `#4D6BFB` (hover `#3D55D6`); Violet `#7A5AF8` (premium/AI accents); Ink Navy `#0B2659` (wordmark); heading navy `#17244F`.
- **Light neutrals:** page `#F7F8FB`, card `#FFFFFF`, border `#E6E9F2`, muted `#98A2B8`, secondary text `#667085`, text `#1F2430`.
- **Semantic:** success `#12B76A`, warning `#F79009`, danger `#E5484D`. WhatsApp green `#25D366` = channel identity only, never UI actions.
- **Fonts:** Plus Jakarta Sans (UI/display 400–800); **Noto Sans Arabic** for Arabic (400/600, +1px size, line-height 1.7, no letter-spacing, no all-caps); JetBrains Mono for IDs/numbers. For long-form article bodies, Arabic body text may go to 16–17px / line-height 1.8 for comfortable reading.
- **Type scale:** 12/13/14/16/20/24/32/52; headings 700–800, tracking −1%.
- **Spacing:** 4px base (4·8·12·16·24·32·48); card padding 24; content max-width 1160 (article text column ~720 for measure).
- **Radius:** 6 inputs, 10 buttons/controls, 16 cards. **Shadows:** navy-tinted `rgba(23,36,79,…)`, never pure black. **Icons:** Lucide only (20px nav, 16px inline, stroke 2).
- **Motion:** 150/200/280ms `cubic-bezier(0.16,1,0.3,1)`; focus-visible ring 2px `#4D6BFB` with 2px offset. **Breakpoints:** 640/768/1024/1280.
- **Logo:** forward chevron mark never flips or rotates — even in RTL.
- **RTL rules:** CSS logical properties only (`margin-inline-start`, `padding-inline-end`…); phone numbers, IDs, URLs, and code stay LTR (`direction:ltr; unicode-bidi:embed`); directional icons flip, media icons and logo don't.
- **Voice:** direct (verbs first), calm (no exclamation marks in product UI), human vocabulary (محادثة/عميل/رد — not جلسة/مستخدم نهائي).

---

## 11. Content Migration from Intercom

Build a small, repo-included migration script (run once, keep for reference):
1. Input: Intercom articles export (HTML/JSON) placed in `/migration/input`.
2. Convert HTML → the block-based `body` format; download referenced images into Supabase Storage; rewrite image URLs.
3. Output a review CSV: old URL, proposed new slug (AR/EN), title, status (imported as **draft** — nothing auto-publishes).
4. Generate the redirects CSV for bulk import into the `redirects` table.
5. Log anything unconvertible for manual handling.

---

## 12. Screens

### Public
- **P1 Home:** hero (title "مركز مساعدة فلوفو", subtitle, large search bar), category cards grid (icon + name + article count), "الأكثر قراءة" pinned articles, escalation footer card. Language switcher pill in header.
- **P2 Category:** breadcrumb, category header, article list (title + excerpt + reading time), empty state with search prompt.
- **P3 Article (the crown jewel):** breadcrumb, title, last-updated date + reading time, body blocks, sticky side TOC (right side in RTL; collapsible "محتويات المقال" accordion on mobile), image lightbox, prev/next article, "هل كانت هذه المقالة مفيدة؟" (نعم/لا + optional comment on لا), related articles, escalation card.
- **P4 Search results:** query echo, grouped/ranked results with highlighted snippets, zero-result state with popular articles + escalation card (and the query silently logged).
- **P5 404 / unknown redirect:** friendly, search prefilled, links to categories.

### Admin (inside the existing roadmap admin shell — new nav section "مركز المساعدة")
- **A1 Articles list:** filter by collection/status/language coverage (badge when a translation is missing), bulk publish/unpublish.
- **A2 Article editor:** AR/EN tabs, block editor with slash-menu or toolbar, slug + meta fields per language, live preview toggle (desktop/mobile, RTL/LTR), publish controls.
- **A3 Collections manager:** CRUD + drag-reorder + icon picker (Lucide).
- **A4 Media library:** upload, alt text AR/EN, usage indicator.
- **A5 Redirects manager:** table CRUD + CSV bulk import + hit counts.
- **A6 Analytics dashboard:** cards per §9 + content-gap inbox.

---

## 13. Acceptance Criteria (definition of done)

1. Publishing an article in admin makes it live on `help.flovoo.com` within seconds (ISR revalidate), with correct meta, JSON-LD, hreflang, and sitemap entry.
2. Arabic search finds "ربط الواتساب" when the article title is "ربط واتساب بفلوفو", and "الحملات" matches "حملات" (normalizer verified by unit tests with hamza/ta-marbuta/ال cases).
3. A zero-result search appears in the content-gap inbox; a "not helpful" vote with comment appears there too.
4. An imported Intercom URL 301-redirects to the new article; the hit counter increments.
5. Publishing/updating an article refreshes its `article_chunks` embeddings; archiving removes them; the AI Agent read contract returns only published content.
6. Article page on a 375px phone: TOC collapses, images zoom, LTR spans (numbers/IDs) render correctly inside RTL text, layout never breaks on language switch.
7. Lighthouse on a published article: SEO ≥ 95, Performance ≥ 85 mobile.
8. RLS verified: anonymous users cannot read drafts or write to anything except feedback/views/search logs (rate-limited).
9. No hardcoded UI strings; all copy through i18n; all Arabic copy in simplified فصحى.

---

## 14. Build Order (phases — stop for review after each)

**Phase 1 — Foundation & public reading experience.** Schema + RLS, seed sample content, public home/category/article pages with full design system, i18n + RTL, sticky TOC, responsive. (No search, no admin yet — use seeded data.)

**Phase 2 — Search & feedback.** Arabic normalizer + trigram + pgvector hybrid search, instant dropdown + results page, query logging, article feedback widget, related articles.

**Phase 3 — Admin.** Help Center section inside the existing admin: articles list, block editor with bilingual tabs + preview, collections manager, media library, publish workflow, ISR revalidation hooks.

**Phase 4 — SEO & redirects.** Meta/OG/JSON-LD/hreflang, sitemaps, robots, auto OG-image generation, redirects middleware + manager + CSV import, 404 flow, Lighthouse pass.

**Phase 5 — Analytics & RAG.** Views/search/helpfulness dashboards, content-gap inbox, embedding pipeline on publish, AI Agent read contract + README docs.

**Phase 6 — Migration & launch polish.** Intercom import script, content review CSV, redirect map, empty states, a11y audit, final QA against §13, DNS cutover checklist for `help.flovoo.com`.

---

## 15. Open Decisions (confirm before or during Phase 1)

- Block editor choice: Tiptap (recommended — JSON output maps cleanly to the block schema, good RTL support) vs. MDX-based.
- Embedding provider/model for chunks (must be strong on Arabic) — keep behind an env var either way.
- Whether Arabic slugs are used verbatim (best for Arabic SEO) or transliterated — recommend verbatim Arabic slugs.
- Escalation card destination: Flovoo live-chat link vs. WhatsApp deep link vs. both.
