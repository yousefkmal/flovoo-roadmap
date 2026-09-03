# Flovoo Public Roadmap & Feedback Portal — Build Prompt

> **How to use this file:** Share this entire document with Claude (or Claude Code / Lovable) as the build brief. It contains full context, scope, data model, screen specs, design system, and acceptance criteria. Build Phase 1 first, then confirm before moving on.

---

## 1. Context

You are building a **customer-facing public roadmap and feedback portal** for **Flovoo** — an Arabic-first unified customer conversation SaaS platform for SMBs in the MENA region (consolidates WhatsApp, Instagram, Messenger, SMS, and live chat into one inbox).

**The problem:** Customers repeatedly ask "when is feature X coming?" and "is it done yet?" via support channels. There is no single place where they can see what's planned, in progress, or shipped — and no structured way for them to submit their own ideas.

**The goal:** A small, simple, and *delightful* portal (think Canny / Featurebase quality, but lightweight and bilingual) with two faces:

1. **Public portal** — customers browse the roadmap, vote on features, submit ideas, and see what shipped.
2. **Admin dashboard** — the Flovoo team manages all displayed data: create/edit features, change statuses, moderate submissions, merge duplicates, publish changelog entries.

**Design bar:** When a customer opens it, the first impression should be joy and professionalism — polished, modern, brand-consistent. This is a marketing asset as much as a product tool.

---

## 2. Scope — Version 1

### In scope
- Public roadmap page (Kanban-style status columns)
- Idea/feature request submission by customers
- Upvoting (one vote per user per item)
- Comments on feature items (optional — Phase 2 if time-constrained)
- Changelog / "What's New" page for shipped items
- Full admin dashboard (CRUD, status management, moderation, merge duplicates)
- **Full bilingual support: Arabic (RTL) + English (LTR)** with instant language switching
- Responsive design (mobile-first — many MENA customers browse on phones)

### Out of scope (do NOT build in v1)
- Email notifications to voters (design the data model to allow it later)
- Internal prioritization scoring (RICE etc.)
- Integrations (Jira, Slack)
- Multi-product / multi-board support

---

## 3. Users & Stories

### Customer (visitor / logged-in Flovoo user)
- As a customer, I can **see the roadmap grouped by status** so I know what's coming without asking support.
- As a customer, I can **search and filter** features by category (e.g., WhatsApp, Inbox, Automation, Reports, Mobile App).
- As a customer, I can **upvote** a feature I need (requires lightweight identification — see §6 Auth).
- As a customer, I can **submit a new idea** with a title, description, and category.
- As a customer, I can **see what shipped recently** in a changelog with dates and short release notes.
- As a customer, I can **switch between Arabic and English** at any time; my choice persists.

### Admin (Flovoo team)
- As an admin, I can **create/edit/archive** feature items with bilingual title + description (AR + EN fields side by side in one form).
- As an admin, I can **change an item's status** (drag between columns or via dropdown).
- As an admin, I can **review incoming customer submissions** in a moderation queue: approve (publish to board), edit, merge into an existing item, or reject with an internal note.
- As an admin, I can **merge duplicates** — votes transfer to the surviving item.
- As an admin, I can **publish a changelog entry** when a feature ships (auto-drafted from the item's data).
- As an admin, I can **pin/feature** specific items at the top of a column.
- As an admin, I see **basic stats**: total votes, top-voted items, submissions this month.

---

## 4. Data Model (suggested — adapt to the stack)

Assume **Supabase (Postgres)** unless told otherwise. All user-facing text fields are bilingual.

```
features
  id            uuid pk
  title_ar      text not null
  title_en      text not null
  description_ar text
  description_en text
  status        enum: under_review | planned | in_progress | shipped | archived
  category_id   fk -> categories
  vote_count    int default 0        -- denormalized for fast sorting
  is_pinned     bool default false
  source        enum: internal | customer_submission
  submitted_by  nullable (name/email or user ref)
  shipped_at    timestamptz nullable
  created_at / updated_at

categories
  id, name_ar, name_en, slug, color, sort_order

votes
  id, feature_id fk, voter_identity (user id or hashed email), created_at
  unique (feature_id, voter_identity)

submissions            -- raw customer ideas before moderation
  id, title, description, category_id nullable,
  submitter_name, submitter_email, language ('ar'|'en'),
  status enum: pending | approved | merged | rejected,
  merged_into fk -> features nullable,
  internal_note text, created_at

changelog_entries
  id, feature_id fk nullable, title_ar, title_en,
  body_ar, body_en, published_at, is_published bool

comments (Phase 2)
  id, feature_id fk, author_identity, body, is_hidden bool, created_at
```

Rules:
- Row Level Security: public can read published features/changelog only; writes to `submissions` and `votes` allowed with rate limiting; everything else admin-only.
- Vote count updates via trigger or RPC to stay consistent.

---

## 5. Screens

### A. Public Portal

**A1 — Roadmap page (the heart of the product)**
- Header: Flovoo logo, page title ("خارطة طريق فلوفو" / "Flovoo Roadmap"), language switcher (AR/EN pill), and a prominent "شارك فكرتك ✨ / Share your idea" button.
- Three Kanban columns: **قيد الدراسة (Under Review)** · **مخطط لها (Planned)** · **قيد التنفيذ (In Progress)**. A fourth "تم الإطلاق (Shipped)" section links to the changelog page (don't crowd the board).
- Each card: title, category chip (colored), vote button with count (heart or chevron-up style, animated on click), short description (2-line clamp), "New" badge for items < 14 days old.
- Filters: category chips row + search input. Sort: most voted / newest.
- Clicking a card opens a **detail drawer/modal**: full description, status timeline, vote button, (Phase 2: comments).
- On mobile: columns become swipeable tabs or stacked sections with sticky status tabs.

**A2 — Submit idea modal**
- Fields: title (required), description, category (select), name + email (or auto-filled if logged in).
- After submit: joyful confirmation state — confetti or a friendly illustration + message: "وصلتنا فكرتك! فريقنا هيراجعها قريب 💙 / We got your idea! Our team will review it soon."
- Anti-spam: honeypot field + rate limit per email/IP.

**A3 — Changelog / "What's New" page**
- Reverse-chronological feed of shipped items, grouped by month.
- Each entry: date, title, short note, category chip, optional image.
- Tone: celebratory ("🚀 أطلقنا…").

### B. Admin Dashboard (separate route, auth-protected)

**B1 — Board manager:** same Kanban view but editable — drag & drop between statuses, inline quick actions (pin, archive, edit).
**B2 — Item editor:** bilingual form with AR and EN fields side by side; category, status, pin toggle; live preview of the public card in both languages.
**B3 — Moderation queue:** list of pending submissions with actions: Approve (opens editor pre-filled, admin adds the missing translation), Merge (search + pick target item; votes transfer), Reject (with internal note). Badge count in nav.
**B4 — Changelog manager:** create/publish entries; "mark as shipped" on a feature auto-drafts an entry.
**B5 — Mini stats header:** total votes, top 5 voted, pending submissions count, submissions this month.

---

## 6. Auth & Identity

- **Public roadmap:** viewable by anyone (no login) — it doubles as social proof for prospects.
- **Voting & submitting:** lightweight identification only — name + email (verified format), stored hashed for vote uniqueness. If the portal is embedded inside the Flovoo app later, use the logged-in user identity instead. Do not force account creation; friction kills participation.
- **Admin:** proper authenticated login (Supabase Auth), role-checked on every admin route and RLS policy.

---

## 7. Bilingual & RTL Requirements (critical — Arabic-first)

- Arabic is the **default** language; English is secondary.
- Full RTL layout in Arabic: mirrored columns, icons, chevrons, drawer direction, and spacing. Use CSS logical properties (`margin-inline-start`, etc.) — never hardcode left/right.
- All UI strings live in a translation dictionary (i18n), never hardcoded. Content fields come from the bilingual DB columns.
- Arabic copy tone: **Modern Standard Arabic that feels warm and simple** (not stiff), suitable for Gulf + Egyptian audiences. No machine-translation feel.
- Numerals: use Western digits (0-9) in both languages for vote counts and dates.
- Dates in Arabic view: Gregorian with Arabic month names (e.g., "١٥ سبتمبر 2026" style is fine with Western digits: "15 سبتمبر 2026").
- Language switch must not lose page state (stay on the same item/filters).

---

## 8. Design System

Follow Flovoo brand identity:

- **Colors:** ink navy `#0E2045` (headings/dark surfaces), cyan `#2DAEFF`, azure `#4C85FF`, indigo `#6370FB`, violet `#7C3AED` (accents/gradients). Use a subtle cyan→violet gradient sparingly (hero header, primary buttons, vote-button active state).
- **Status colors:** Under Review = neutral slate, Planned = azure, In Progress = amber/indigo, Shipped = green.
- **Typography:** Arabic: **Cairo** (or IBM Plex Sans Arabic); English: Inter or the same Plex family. Generous line-height for Arabic (≥1.7).
- **Feel:** light background, soft shadows, 16px+ radius cards, micro-interactions (vote button pop + count increment animation, smooth column transitions, skeleton loaders).
- **Delight moments:** submission confetti, animated empty states with friendly bilingual copy ("لسه مفيش أفكار هنا — كن أول من يقترح!"), subtle hover lift on cards.
- Accessibility: WCAG AA contrast, keyboard navigable, focus states, `dir` and `lang` attributes set correctly.

---

## 9. Acceptance Criteria (definition of done)

1. Roadmap loads in < 2s with skeletons; works flawlessly in AR (RTL) and EN (LTR) with zero layout breakage when switching.
2. A visitor can vote once per item (double-vote blocked) and submit an idea; the idea appears in the admin moderation queue, not the public board.
3. Admin can approve a submission, add its translation, and it appears on the public board instantly.
4. Merging two items transfers votes correctly and hides the duplicate.
5. Marking an item "Shipped" moves it off the board and (after admin publish) shows it on the changelog page.
6. Fully responsive: board is usable on a 375px-wide phone.
7. No hardcoded UI strings; all copy passes through i18n.
8. RLS verified: anonymous users cannot read pending submissions or write to features.

---

## 10. Build Order (phases)

1. **Phase 1:** Data model + public roadmap page (read-only) + language switching + design system.
2. **Phase 2:** Voting + idea submission + confirmation states + anti-spam.
3. **Phase 3:** Admin dashboard (board manager, item editor, moderation queue, merge).
4. **Phase 4:** Changelog page + changelog manager + stats header + polish pass (animations, empty states, a11y audit).

Stop after each phase and present the result for review before continuing.

---

## 11. Open Decisions (confirm with Yousef before or during Phase 1)

- Hosting/embedding: standalone subdomain (`roadmap.flovoo.com`) vs. a section inside the app? (Recommend standalone subdomain — works as public social proof and is linkable from Intercom.)
- Whether comments ship in v1 or wait.
- Whether voting identity should link to real Flovoo accounts from day one.
