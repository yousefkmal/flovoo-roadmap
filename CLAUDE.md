@AGENTS.md

# Flovoo Public Roadmap & Feedback Portal

A customer-facing roadmap and changelog for Flovoo, an Arabic-first business
messaging platform. Visitors follow what is being built, vote, submit ideas, and
read release notes. The team runs it from an admin dashboard on the same app.

**Arabic is the product default, not a fallback.** `/ar` is where an unknown
visitor lands; English is the translation. Every layout, string and date is
written that way round.

Live at `news.flovoo.com` (Vercel + Supabase). Deployment walkthrough is in
`DEPLOY.md`; design rationale and measured departures are in `README.md`.

## Stack

- **Next.js 16.3.4** — App Router, React 19.2, Turbopack. Read
  `node_modules/next/dist/docs/` before writing routing or metadata code; this
  version differs from most training data (`params` is a Promise, `cookies()` is
  async, `middleware.ts` is `proxy.ts`, `PageProps`/`LayoutProps` are global).
- **TypeScript strict**, **Tailwind CSS v4** (`@theme` / `@utility`, no config file)
- **Supabase** — Postgres, RLS, `@supabase/ssr` for cookie-based sessions
- **@dnd-kit/core** — admin board drag and drop
- **lucide-react** — the only icon set (design-system rule)
- **motion** — installed; most animation is CSS

```bash
npm run dev        # never start this from Bash — use the preview tooling
npm run build      # Turbopack production build
npm run lint       # eslint, including react-hooks rules that catch real bugs
npm run typecheck  # tsc --noEmit
npm run seed:sql   # regenerate supabase/seed.sql + seed-help.sql from the TS seeds
npm run db:migrate # apply pending supabase/migrations to SUPABASE_DB_URL (see below)
```

## Structure

```
src/app/[locale]/          every route is locale-prefixed
  page.tsx                 the roadmap board
  updates/                 the changelog tab + feed.xml
  admin/                   board manager, moderation queue, changelog manager
  auth/callback/route.ts   where Google and email links come back to
  actions.ts               public Server Actions (vote, follow, submit, sign in)
  admin/actions.ts         admin Server Actions — every one calls requireAdmin()
src/components/            roadmap/ updates/ admin/ account/ vote/ submit/ ui/
src/lib/data/              repository (reads) + mutations (writes), see below
src/lib/auth/              session, admin resolution, dev stand-in
src/i18n/                  config + ar/en dictionaries (the only source of copy)
src/proxy.ts               locale redirect: cookie → Accept-Language → Arabic
supabase/migrations/       0001_init → 0004_changelog_links, run in order
tools/og-card.html         source of the share-card images
```

## The data layer

**Two pairs, split by privilege.** `repository.ts` / `mutations.ts` use the anon
key and are what visitors touch. `admin-repository.ts` / `admin-mutations.ts`
use the service-role key, bypass RLS, and are only reachable behind
`requireAdmin()`.

**Everything works without Supabase.** When `NEXT_PUBLIC_SUPABASE_URL` is unset,
both pairs fall back to `seed.ts` layered over `local-store.ts`, an in-process
store of votes, follows, reactions, submissions, profiles and edits. This is how
the whole product can be exercised before anyone provisions a project.

`local-store.ts` merges seed and runtime state through one helper per entity —
`localFeatureState`, `localChangelogState`. **Use them.** Two call sites once
merged state differently and the public and admin boards silently disagreed
about which features existed.

The fallback is a development affordance only. In production the in-memory store
is per-instance and resets constantly, so an empty board on a deployed site means
Supabase is connected and the tables are empty, not that the fallback is serving.

## Database

Enums: `feature_status` (under_review · planned · in_progress · shipped ·
archived) · `feature_source` · `submission_status` · `content_language` ·
`changelog_kind` · `notification_scope` · `notification_status`

| Table | Holds |
| --- | --- |
| `categories` | `slug`, `name_ar/en`, `color`, `sort_order` |
| `features` | the board. Bilingual title/description, `status`, `vote_count`, `is_pinned`, `source`, `shipped_at`, and a picture (`image_url` + bilingual alt, 0022) |
| `votes` | one row per person per feature, `voter_identity` + `user_id` |
| `submissions` | customer ideas awaiting moderation, `merged_into`, `created_feature`, `internal_note`, `ip_hash` |
| `changelog_entries` | release notes. Bilingual body, `image_url` + alt per language, `article_url`, `action_url` + labels, `is_published` |
| `changelog_reactions` | emoji per entry per user, emoji constrained by check |
| `profiles` | mirrors `auth.users` via the `handle_new_user` trigger — `display_name`, `locale`, `notify_scope` |
| `feature_subscriptions` | explicit "notify me" per feature |
| `notification_outbox` | queued emails. Fills correctly; **nothing drains it yet** |
| `admin_users` | the durable admin roster; what `is_admin()` checks |
| `comments` | table exists, deliberately not built in v1 |

Functions: `is_admin()` (every RLS policy routes through it) ·
`sync_feature_vote_count()` (trigger keeping `vote_count` honest) ·
`enqueue_shipped_notifications(target_feature)` · `merge_features()` ·
`public_board()` · `handle_new_user()` · `set_updated_at()`

Only four of the five statuses render publicly — `BOARD_STATUSES` in
`src/lib/types.ts`. `archived` exists for merges, which archive the duplicate
rather than deleting it so the history survives.

## Auth

Google OAuth and email magic links, both through Supabase.

`ADMIN_EMAILS` is the **bootstrap** list — something has to grant the first
admin and it cannot be the admin table. After that, `admin_users` is the roster.
Both are checked, in that order.

The guard sits in three places on purpose: the admin layout gates the UI, every
admin **page** calls `requireAdminPage()` before reading data, and every admin
action re-resolves the session itself. A Server Action is a reachable endpoint
whether or not a page renders a button for it — and a page segment renders on
the server even when the layout does not place it, so without the page-level
guard its data (draft titles, submitter emails) travelled in the response
payload to anyone who requested the URL. Found and fixed during Phase 3.

`dev-session.ts` accepts any address without verification and **refuses to run in
production** — it exists so the full flow can be exercised with no Supabase
project. Everyone is an admin there, bounded by the same guard.

The callback accepts two arrivals. `code` is PKCE, bound to a verifier cookie in
the browser that started the sign-in, so a link opened on a phone cannot finish.
`token_hash` carries no browser-side secret and works cross-device; point the
Supabase email template at it. Editing that template needs custom SMTP.

## Design

Follow the `flovoo-design-system` skill. Load it before any visual work rather
than styling from memory. Hard constraints: the gradient
(`135deg, #2EA8FF → #4D6BFB → #7A5AF8`) is one CTA per view; dark mode is
navy-tinted never gray; shadows are navy-tinted; Lucide icons only; logical CSS
properties everywhere (`margin-inline-start`, never `left`).

Tokens live in `src/app/globals.css`. Dark mode is a single
`:root[data-theme="dark"]` block, not a media-query duplicate.

**The board has three surfaces** — `--color-page`, `--color-column`,
`--color-card` — matched to the Featurebase reference the product was specced
against. A column is a tinted panel behind the cards, not a bare region.

Departures from either the design system or the reference are documented in the
README with the measurement that justified them. Two worth knowing:

- `--color-brand-solid` (`#3d55d6`) exists because the accent `#4D6BFB` measures
  4.36:1 as small text on white. It clears AA as a fill, not as type.
- `--color-text-tertiary` and `--color-placeholder` exist because the system's
  `muted` is a 3:1 colour being used for readable text.

**Voice:** verbs first, no exclamation marks in product UI, say "chat" and
"customer". Errors state what happened and the next step. All copy lives in the
dictionaries; never inline a string in a component.

## RTL and bilingual rules

- `dir` and `lang` are set on `<html>` in the locale layout, never patched client-side.
- Two numeral utilities, and they are not interchangeable: `.numeral` forces LTR
  for a standalone number; `.numeric` is for a number inside a sentence.
  Using `.numeral` on mixed Arabic text corrupts the bidi order — "13 من 13"
  rendered as "13 13 من" before this split.
- Both languages are mandatory on any content record. The editors show them side
  by side and the server refuses a half-translated save.

### Help center — analytics and RAG (Phase 5)

- **Views are beaconed, not rendered**: article pages are static, so
  `ViewTracker` posts once per browser session to `/api/help/view`. The session
  id is random, browser-made, hashed again server-side; the referrer is reduced
  to a hostname. No address, no user agent, no PII.
- **Aggregates live in SQL** (`0009`, guard fixed in `0010`). They are
  security-definer and check `help_analytics_allowed()` — an admin in the
  roster **or** the service role. `is_admin()` alone was wrong: it resolves
  through `auth.uid()`, which is null for the service key the dashboard reads
  with *and* for a bootstrap admin who is in `ADMIN_EMAILS` but not yet in
  `admin_users`. Verified: service key sees the data, anon key sees nothing.
- **Chunking** is `chunks-core.ts` (pure, unit tested) wrapped by `chunks.ts`
  (database + embeddings). `syncArticleChunks()` runs after every save and
  status change and can never fail the save.
- **The agent contract is versioned** (`/api/agent/v1/*`) and documented in the
  README. Additive changes only; a breaking change is `/v2`.
- **A value exported from a `"use client"` module reaches a server component as
  a reference proxy, not the object.** Reading a field off it throws at render
  time. `suggestSlug` and `EMPTY_TRANSLATION` both hit this; they now live in
  `lib/help/slug.ts` and `lib/help/editor-draft.ts`. Keep shared values out of
  client components.

## Intercom migration — the token is temporary

Content comes in through Intercom's **API**, not a file export: `INTERCOM_ACCESS_TOKEN`
in `.env.local`, from a read-only internal app in Intercom's Developer Hub. The
region host (`api.intercom.io` / `api.eu.intercom.io` / `api.au.intercom.io`) is
detected, not configured.

**When the migration finishes, tell the user to delete that internal app and
clear the variable.** They asked to be reminded; do not wait to be asked. The
token reads the whole workspace and stays valid until the app is deleted.

### What ran, in order

1. `npm run intercom:export` — the raw safety net: 15 collections, 55 articles,
   116 news items, written to `migration/intercom-export/` untouched.
2. `npm run intercom:images` — 203 images pulled down **before their signed
   URLs expired**. That deadline is why the export runs before any decision.
3. `npm run intercom:survey` — what Intercom holds versus what this schema
   supports, so the gaps reach the user instead of being decided for them.
4. `npm run intercom:private-backup` — 224 conversations with their message
   threads, 419 contacts, 230 companies, into `migration/private-backup/`.
   **Disk only.** That folder is git-ignored and this data never enters the
   database; it is personal information kept only because closing the account
   destroys it.
5. `npm run intercom:import` — plans and writes `migration/import-review.md`;
   `-- --apply` uploads the images and imports.

### Rules the importer holds to

- **Everything imports as a draft**, including articles Intercom had published,
  and every collection lands unpublished. "Import as drafts" is meaningless if
  visitors can see empty topics.
- **The delete and the import are one transaction.** The samples are removed and
  the Intercom content inserted together, so a failure leaves the samples
  standing. This was not theoretical: the first `--apply` threw partway and the
  rollback held.
- **Images are uploaded before the transaction**, at a path derived from a hash
  of their source URL, so re-running neither duplicates nor re-sends them.
  Object storage cannot join a database transaction; making the upload
  idempotent is what replaces that.
- **`scripts/intercom-html.ts` refuses to guess.** Any tag, attribute or shape
  it does not recognise is collected and the import stops before writing. An
  unknown tag silently dropped is content nobody can recover once Intercom is
  closed.
- **Old addresses are matched three ways** — exact, percent-decoded, and by the
  Intercom id alone (`/ar/articles/16536857`). The id survives a retitling; the
  slug in a saved link does not. `redirect-candidates.ts` is pure and unit
  tested for exactly this.

Result: 54 articles (the Spanish demo dropped by decision), 99 translations,
16 collections, 202 images, 231 redirects. All 90 real Intercom addresses
resolve. `migration/import-review.md` is the inventory the user reviews.

### News → the changelog (migrations 0011, 0012)

Intercom's News became `changelog_entries`. Two things had to change first.

- **Bodies are rich now** (`0012`). They were plain text rendered as paragraphs;
  98% of the 116 announcements use a list, bold, a link or a heading, so
  flattening them would have lost the readable part. They hold the same
  ProseMirror JSON as help articles, and the editor (`BlockEditor`) and renderer
  (`ArticleBody`) are the help center's — one vocabulary, no mapping layer.
  `src/lib/changelog/body.ts` is the pure helper; the two entries written before
  the migration were converted in place. `EntryBody` now takes a rendered node,
  built on the server, instead of a string array.
- **Alt text can be a draft** (`0011`). See below.

**Intercom stores no field linking an announcement's Arabic half to its English
one.** The pairing is inferred, and the inference is validated: 31 pairs are
proved by a shared cover image, and the position-and-time rule was tested
against those — it gets 30 of 31 right *only* with the direction constraint
(the Arabic item is written after its English twin and carries the higher id).
Without it the ids interleave and a nearest-match rule pairs each item with the
wrong side: 8 of 31. If you ever re-run this, keep that constraint.

Result: 54 bilingual entries, 8 untitled drafts skipped, 74 covers, 13 links
rewritten onto the new help articles. Additive — nothing already in the
changelog was touched, and everything landed unpublished.

**Open: one cover per language.** 21 of the 54 announcements had a different
cover in each language (an Arabic screenshot and an English one).
`changelog_entries.image_url` is a single shared column, so the Arabic cover is
stored for both. All 74 covers are uploaded, so the fix is one migration adding
a per-language column, not another download. Written up in
`migration/news-review.md`.

### Alt text is required to publish, not to save

`validateTranslation()` takes `requireAlt`, set from `status === "published"`.
A draft may hold an image with no alt text — an editor pasting a screenshot
mid-sentence should not be blocked, and the 202 images imported from Intercom
arrived with none. The requirement still holds the moment a reader could see
the image.

**Every path that publishes must run the check, not just the editor.** The
guard lived only in `saveHelpArticleAction`, so the articles list's bulk
"publish" (`setHelpArticlesStatusAction`) walked straight past it — 20 articles
went live carrying machine-written descriptions before anyone noticed. Both
actions call `figureWithoutAlt()` now. When you add another way to change
status, it needs the same check.

**Generated descriptions are marked, and the mark is what publishing checks.**
All 202 article images and 74 news covers were described by reading them, and
saved as drafts: `altDraft: true` on the figure node, `alt_needs_review` on
`help_media` (migration 0011). `figureWithoutAlt()` treats a draft alt as no alt,
so an article cannot be published until somebody has been through them; editing
the field in the editor clears the flag, and the editor shows an "unreviewed"
badge until it does. The pipeline is `help:alt-worklist` → describe →
`help:alt-apply`, and `news:alt-apply` for the covers.

## Before the first production deploy — do not skip

**The help center must ship `noindex` and be blocked in `robots.txt` on its
first deploy.** It rides on the roadmap's domain until `help.flovoo.com` is
pointed at it, and the content is still incomplete; letting Google index
`news.flovoo.com/ar/help/...` would put the wrong host in the index and cost
more to undo than to prevent. Set `NEXT_PUBLIC_HELP_INDEXABLE=false` (the
default is unset, which means *not* indexable) and confirm:

- every help page emits `<meta name="robots" content="noindex, nofollow">`,
- `robots.txt` disallows `/ar/help` and `/en/help`,
- the sitemaps omit help URLs.

Open indexing (`NEXT_PUBLIC_HELP_INDEXABLE=true`) only once `help.flovoo.com`
resolves to this app **and** the content is ready to be found. Decided at the
Phase 4 review, 2026-09-05.

## The help center is live at help.flovoo.com

Deployed 2026-09-06. `help.flovoo.com` and `news.flovoo.com` are the same
Vercel project; the host is the switch (`proxy.ts`), and it only works when
**`NEXT_PUBLIC_HELP_URL` is set in Vercel**. It was missing on the first
deploy, so the help host served the roadmap and all 231 old Intercom links
404'd. Adding the domain also made it Vercel's production URL, which dragged
the roadmap's own canonical and sitemap URLs onto the wrong host until
`NEXT_PUBLIC_SITE_URL=https://news.flovoo.com` was set explicitly. Both are
build-time variables: changing them needs a redeploy, not just a save.

**Indexing is still closed** — `NEXT_PUBLIC_HELP_INDEXABLE` is unset, which
is what keeps `noindex` on every help page. Verified live.

`npm run check:help-links` answers the question that decides whether the
domain is safe to move: does every stored redirect reach a page a reader can
actually see? It reads the database, and its answer matched the live domain
exactly (182 of 231) — so it can be trusted without hitting the network.
The other 49 point at articles the user deliberately left unpublished
because they were empty in Intercom too.

## Phase 7A — AI visibility: access & discoverability

The help center is written to be read by assistants, not only by people.

- **`src/config/ai-crawlers.ts` is the single list.** robots.txt, the access
  check, the referral labels and the "ask an assistant" targets all read from
  it. Adding a bot there adds it everywhere. (The brief writes it as a
  root-level `config/`; it sits in `src/` so the `@/` alias resolves it.)
- **robots.txt names every bot explicitly** instead of relying on `*`. Some AI
  crawlers only obey a block naming them, and an explicit file is also a
  statement of intent. Training crawlers are allowed by decision. `npm test`
  fails if a search-class bot is ever disallowed.
- **The launch `noindex` gate is gone.** `NEXT_PUBLIC_HELP_INDEXABLE` no longer
  exists; `helpRobots` is permanently `undefined` and a test pins it. Closing
  indexing again is now a deliberate code change, which is the point.
- **`<article-url>.md` serves clean Markdown**, and `Accept: text/markdown`
  reaches the same handler. The public address keeps the `.md` suffix because
  `proxy.ts` rewrites it to `/api/help/markdown/…`; the route matcher had to
  stop treating `.md` as a static asset for that to work.
- **`/llms.txt` and `/llms-full.txt`** are generated on publish. Build them
  from `getPublishedArticlesForExport()`, never article by article:
  `getHelpArticleBySlug` resolves siblings per call, so the corpus took long
  enough to time out. One pass, two seconds.
- **IndexNow pings on publish and unpublish** (`src/lib/help/indexnow.ts`),
  logged in `help_indexnow_pings`. Optional: no `INDEXNOW_KEY`, no pings, no
  failure. Never awaited into a save — a search engine being down must not
  cost somebody their edit.
- **`npm run check:ai-access`** fetches a real article as each bot and insists
  on 200 *with the article's text*: a bot-protection challenge also returns
  200, so status alone proves nothing. Run it against the live host after any
  deploy that touches robots or routing.
- The sitemap takes ~40s in dev and 0.6s in production, where it is
  prerendered. Give the check a generous timeout rather than chasing it.

## Phase 7B–7E — extraction, tracking, citations

**7B: written so a machine can lift the answer out.**

- Four fields on `help_article_translations` (`0017`): `answer_summary` (the
  answer in one or two sentences, shown as the lede and used as the meta
  description), `question_title` (the same article phrased as the question a
  reader would type), `key_facts` (jsonb list of label/value pairs, rendered as
  a table and as `DefinedTerm` where it fits), `review_due_at`.
- **The summary is advice, not a gate** (changed 2026-09-09). Publishing used
  to refuse an article without one, and no longer does: it is guidance, and
  guidance belongs in the readiness score rather than a locked door. The only
  thing publishing still refuses is an image with no alt text.
- **The column itself refuses a summary outside 80–700 characters** (`0017`),
  and the action validates that bound before the row is written. Without that
  check Postgres rejects the row and the whole save fails with a generic error
  pointing at no field.
- **A drafted summary is invisible until somebody approves it** (`0021`).
  All 38 published articles predate 7B, so 74 summaries were drafted in bulk
  (`help:summary-worklist` → write → `help:summary-apply`) with
  `summary_needs_review = true`. That flag means *absent*: `reviewedSummary()`
  in `help-repository.ts` nulls it for the page, the `.md` endpoint, the meta
  description and `llms.txt`. Editing the field clears it, and so does the
  editor's approve button. Publishing no longer checks it — the flag hides the
  text from readers, which is the part that matters.
  **Deploy that guard before writing drafts to production, not after.** Doing
  it the other way round put the drafts on live pages for a few minutes: the
  deployed code read `answer_summary` directly and the ISR window expired
  while the new build was still going out.
- `/[locale]/help/glossary` and `/[locale]/help/about` exist because an
  assistant answering "what is Flovoo" needs one page that says so plainly.
  The glossary emits `DefinedTerm`; `about` emits `Organization` with a stable
  `@id` so the entity is the same object across pages.
- `src/config/brand.ts` holds the product's names in both languages.
  `BRAND_VARIANTS` are the misspellings worth matching in a citation check;
  `brand.test.ts` pins them with word boundaries, because "Flovo" is a
  substring of "Flovoo" and a naive `includes` calls every mention a
  misspelling.
- **`CopyPageMenu`** copies the article as Markdown, or opens it in ChatGPT /
  Claude / Perplexity with a prompt already written. The targets come from
  `ASSISTANT_TARGETS` in `ai-crawlers.ts`; clicks go to `help_assistant_clicks`.

**7C: who is actually reading it.**

- `noteCrawler()` in `proxy.ts` fires and forgets a POST to
  `/api/help/crawler-hit`; the proxy runs on the edge and cannot reach the
  database. Never await it into the response.
- **A user agent is a claim, not an identity.** `crawler-log.ts` does
  forward-confirmed reverse DNS — PTR, then A/AAAA back — and stores the
  verdict per hit. An unverified `GPTBot` string is recorded as unverified,
  not as GPTBot. IPs are hashed, never stored.
- `classifyUserAgent` matches the **longest** token, so `Claude-SearchBot` is
  not swallowed by `ClaudeBot`. A test pins that.
- Human arrivals from an assistant are labelled by referrer
  (`aiSourceFromReferrer` → `help_article_views.ai_source`). ChatGPT strips the
  referrer on some paths, so this undercounts and the dashboard says so.
- `help_ai_crawler_daily` is a rollup whose `article_id` may be null (a hit on
  `/llms.txt` belongs to no article). `0019` rebuilt it with a unique
  **expression** index over `coalesce(article_id, '000…')`, because a generated
  column in a primary key cannot be null — `0018` silently rejected every
  non-article hit until that was found.

**7E: does the answer cite us.**

- `help_geo_prompts` holds 30 real questions per language; the weekly cron
  (`vercel.json` → `/api/help/citation-run`, Mondays 06:00 UTC) asks each
  configured provider and stores the answer text with the verdict. **The route
  accepts GET** — that is what Vercel Cron sends — and authorises against
  `CITATION_RUN_SECRET` or Vercel's `CRON_SECRET`. With neither set it answers
  503 "not configured", which is the current live state.
- Anthropic is the only provider wired (`ANTHROPIC_API_KEY`). `providers()`
  returns an empty list when nothing is configured and the run is a no-op.
- **A run is a sample, not a measurement.** Models are non-deterministic, have
  their own retrieval, and personalise. One citation is not a ranking, and the
  dashboard prints that caveat rather than implying a metric.
  `help_geo_manual_checks` is there because the user checking by hand is still
  the best signal available.
- **`lib/help/content-checks.ts` is the readiness checklist** — nineteen items
  covering SEO and GEO together, weighted by impact and summing to 100. It
  replaced `lib/help/geo.ts` (ten GEO-only items) on 2026-09-09. Pure and
  dependency-free, because the blog runs the same file: each estate builds its
  own `ContentSnapshot` (`content-snapshot.ts` here, HTML-based on the website)
  and the checks read only that.
  **A check that does not apply leaves the sum**, numerator and denominator
  both — an article with no images is not marked down for having no alt text —
  so 100 means "nothing left that applies", not "nothing was looked at".
  The editor shows it as `ReadinessPanel` and the article list shows the score
  per language. **Advice, never a gate.**
- The AI dashboard is `/[locale]/admin/help/ai` (+ `/prompts`). Both are in
  `scripts/check-admin-guard.ts`; both were verified with a marker row that a
  cookieless request must not return.

## Permanent checks

Run these before calling any phase done, and again before a deploy.

- **Admin pages leak nothing without a session.** For every admin route,
  request the URL with no cookies and confirm the response contains no admin
  data — not merely that the interface is hidden. `npm run check:admin-guard`
  does this against the running dev server (or `BASE_URL=… ` for production)
  and fails on any private field name in the payload. When you add an admin
  page: call `requireAdminPage()` first, then add its path to
  `scripts/check-admin-guard.ts`. This exists because the layout-only guard
  shipped a real leak (draft titles, submitter emails) until Phase 3 of the
  help center found it.
- **Customer data never reaches git or the database.** `migration/private-backup/`
  holds conversations, contacts and companies pulled out of Intercom. It is
  excluded in `.gitignore`; confirm with `git check-ignore -v` and
  `git add -A --dry-run | grep private-backup` before any commit. Nothing in
  `src/` reads it and no migration loads it.
- **Every publish path enforces alt text.** There is more than one way to
  publish an article (the editor, and the list's bulk action). Each has to run
  `figureWithoutAlt()`; a new one that skips it silently reopens the hole.
- **Bulk content work lands as marked drafts, never as live content.** Alt
  text (0011) and answer summaries (0021) both follow it: write the draft,
  mark it, treat the mark as absence everywhere a reader looks. Ship the code
  that honours the mark *first*.
- **Every AI system we allow can still read an article.** `npm run check:ai-access`
  against the live host after any change to robots.txt, the proxy, routing or a
  CDN rule. A "200" is not enough — the check looks for the article's own text,
  because a challenge page is also a 200.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; the build
  must still list the help pages as prerendered (`●`).

## Gotchas this codebase has already paid for

- **Two column lists for one table is how four fields went missing.** The
  Supabase branch of `saveHelpArticle` had its own inlined `upsert` object
  beside the shared row builder; it carried the title, body and meta and
  silently dropped `answer_summary`, `question_title`, `key_facts` and
  `summary_needs_review`. No error, no clue — the fields simply came back empty
  on reopening. One builder (`lib/help/translation-row.ts`) now serves both
  backends and is unit tested. When you add a column, add it there and nowhere
  else.
- **`animate-fade-up` with `fill-mode: both`** pinned opacity at 0 in hidden
  tabs where animations never advance. Animate transform only.
- **dnd-kit needs a stable `DndContext id`** or its generated `aria-describedby`
  hydrates mismatched on every draggable.
- **`next/og` reverses Arabic word order.** Share cards are rendered from
  `tools/og-card.html` in a real browser and committed as PNGs. Do not move them
  back to a route.
- **Supabase matches redirect URLs as whole strings** (only the Site URL's own
  host is exempt). A `?next=` on the callback URL made every local Google
  sign-in land on production. The return path now rides in the
  `flovoo_auth_next` cookie (`lib/auth/return-path.ts`) and the callback URL is
  bare; add `http://localhost:3000/**` to the allow list for good measure.
- **A phone on the LAN gets HTML but no JavaScript from `next dev`** unless its
  origin is in `allowedDevOrigins`. Buttons highlight on tap and do nothing;
  the console shows only a failed HMR socket. Restart the dev server after
  changing the config.
- **A stale `.next` after deleting files** leaves the dev server broken while the
  production build is clean. `rm -rf .next` and restart.
- **Measure the live DOM, not screenshots**, when matching the reference — and
  sample the painted stack with `elementsFromPoint`, not single elements. A
  column panel was missed for several rounds because it was an absolutely
  positioned sibling.
- **Re-audit contrast from a clean load.** Measuring right after a theme flip
  samples colours mid-transition and produces false positives.
- `eslint`'s react-hooks rules have caught real bugs here repeatedly — `Date.now()`
  during render, setState in effects. Do not silence them.

## Help center (`/[locale]/help`, served as `help.flovoo.com`)

The same app, a second product. The brief is `flovoo-help-center-build-prompt.md`;
it is built one phase at a time and stops for review after each. **Phase 1 is
done**: schema, seed, the public home / category / article pages.

- **Routes** live under `src/app/[locale]/help/*`. In production the help host
  is mapped onto them by `proxy.ts`; `src/lib/help/paths.ts` builds every public
  link from `NEXT_PUBLIC_HELP_URL`, so static HTML never guesses the host. Always
  link through those helpers, never with a literal `/help/` path.
- **Tables** are prefixed `help_` (`0005_help_center.sql`): `help_collections`,
  `help_articles`, `help_article_translations`, `help_media`, and the event
  tables `help_article_feedback` / `help_article_views` / `help_search_queries` /
  `help_redirects`. Chunks, pgvector and pg_trgm arrive with search and RAG.
- **Bodies are Tiptap-compatible ProseMirror JSON** (`src/lib/help/blocks.ts`),
  rendered by `ArticleBody.tsx`. `body_plain`, `toc` and `reading_minutes` are
  derived by `deriveArticleMeta()` on every save — the seed generator does it
  now, the admin editor will in Phase 3. Never hand-edit them.
- **Slugs are verbatim Arabic**, unique per language, percent-encoded only in
  the URL. Collections keep one Latin slug shared by both languages.
- **The pages are static with ISR** and read no session. Anything that needs the
  query string (the missing-translation notice) is a client component in a
  Suspense boundary, as `AuthNotice` is. `help/not-found.tsx` gets its locale
  from `next/root-params`, because a not-found boundary has no params — reading
  `headers()` there silently turned the whole help segment dynamic once.
- **Every help page has the persistent topic sidebar** (`HelpShell` +
  `HelpSidebarNav`), anchored to the inline-start edge of the viewport — right
  in Arabic, left in English — with the content area taking the rest and each
  page centring its own reading column. The brief's "no sidebar on the
  homepage" was withdrawn at the Phase 1 review. Below `lg` it lives behind the
  header's menu button (`HelpMobileNav`, a native dialog) and is never visible
  by default. Data comes from `getHelpNavigation()`.
- **Help text tokens are scoped**: `help/layout.tsx` wraps the pages in
  `.help-surface`, which redefines `--color-text` and friends to the Flovoo
  system's primary text (#1F2430) for long-form reading. The roadmap keeps its
  own measured values. Do not edit the root tokens to fix help contrast.
- **Articles can carry a section** (`section_ar` / `section_en`, both or
  neither) that groups them into one card each on the category page
  (`groupArticlesBySection`, `ArticleSectionCard`). Articles without one share a
  card titled "Articles".
- The article's outline rail sits at the **inline end** (left in Arabic, right in
  English), opposite the sidebar, and only from `xl` up because three columns
  share the `max-w-board` track; below that it folds into the accordion.
- **Density.** Prose is the system body pair (14/1.65 Latin, 15/1.75 Arabic),
  titles are 24px, section titles 16px. The reviewer found the brief's 16–17px
  long-form setting heavy on a phone; do not drift back up.
- **Counts are pluralized** through `src/lib/help/format.ts` — Arabic has four
  forms. Never format a count with a bare `{count}` template.
- **Local dev without Supabase** serves `help-seed.ts`. One seed article is
  Arabic-only on purpose (the missing-translation path) and one is a draft
  (must never render publicly).

### Help center — search and feedback (Phase 2)

- **Arabic normalization lives in two places that must agree**:
  `src/lib/help/arabic.ts` (TypeScript, pinned by `npm test`) and
  `help_normalize()` in `0006_help_search.sql`. Hamza → ا, ى → ي, ة → ه,
  diacritics and tatweel dropped, Arabic-Indic digits → 0-9, a fused definite
  article (ال، وال، بال، فال، كال، لل) stripped when three letters remain.
- **Search is hybrid**: trigram similarity on the normalized title (boosted) and
  text, plus cosine similarity over `help_article_chunks` when an embedding is
  available. `searchHelp()` in `src/lib/help/search.ts` calls the `help_search()`
  RPC with Supabase and runs the same formula over the seed without it.
  Snippets and `<mark>` highlighting are always built in TypeScript.
- **Embeddings are optional and env-driven** (`HELP_EMBEDDING_*`, OpenAI API
  shape, 1536-wide). Unset → lexical only, no error. Chunks are written by the
  Phase 5 pipeline; until then the semantic leg finds nothing.
- **Logging**: the results page logs every query server-side; the search box
  logs the query the reader settled on (800 ms after results arrive), never
  keystrokes. Clicks are attributed by beacon. Writes prefer the service key so
  the row id comes back; the anon key can insert but not read these tables.
- **Feedback** is a public Server Action (`help/actions.ts`) with a hashed
  IP+UA visitor id, rate limited, remembered per article in localStorage via
  `useSyncExternalStore` — not an effect, which the hooks lint forbids here.
- **Related articles** = same topic first, then lexical closeness
  (`help_related()` / the local mirror). Embedding similarity joins later
  without changing the result shape.
- `/api/help/*` routes sit outside the locale prefix; the proxy matcher already
  skips `api`.

### Help center — admin (Phase 3)

- Lives under `src/app/[locale]/admin/help/*` behind the existing admin layout
  guard; every action in `admin/help/actions.ts` calls `requireAdmin()` itself.
  Sub-navigation: articles · topics · media (`HelpAdminNav`).
- **The articles list loads every body**, because the readiness column cannot
  be computed without reading the article. Roughly a megabyte across seventy
  articles, on an admin page behind auth; the media page already did the same
  for its usage count. Do not "optimise" it back to heads-only without also
  removing the column.
- **Data**: `help-admin-repository.ts` / `help-admin-mutations.ts` (service
  role). Without Supabase they read and write the same `localHelpContent()`
  snapshot the public repository reads — never merge seed and edits elsewhere.
- **The editor is Tiptap v3** (`components/admin/help/editor/`). Custom nodes in
  `extensions.ts` carry exactly the names `ArticleBody.tsx` renders. Before a
  save the editor JSON goes through `JSON.parse(JSON.stringify(…))`:
  ProseMirror builds attrs with `Object.create(null)` and React will not pass
  prototype-less objects into a Server Action ("temporary client reference").
- **Arabic is required, English optional** on save; publishing with Arabic only
  is allowed and shows the missing-translation notice publicly.
- **Media** uploads go through `POST /api/admin/help/media` (Route Handler, so
  no action body limit), into the public `help-media` bucket (migration 0007)
  or `public/help-uploads/` locally. The library refuses to delete a file an
  article body references.
- **Revalidation**: `revalidatePath("/[locale]/help", "layout")` after every
  write — a topic rename touches the sidebar on every page anyway.
- Testing the admin locally with Supabase configured needs a real sign-in; the
  dev stub only runs without Supabase. Park `.env.local` (rename it) and
  restart to exercise the admin against the local store, then restore it.

### Help center — SEO and redirects (Phase 4)

- **JSON-LD** (`lib/help/seo.ts`, `<JsonLd>`): TechArticle + BreadcrumbList on
  articles, FAQPage when a body has FAQ blocks, BreadcrumbList on topics,
  WebSite with SearchAction on the home. Open Graph and Twitter fields come
  from `helpSocialMetadata()`.
- **Share cards are rasterised SVG**, not `ImageResponse`: `/api/og/help`
  renders with `@resvg/resvg-js` and the fonts in `src/lib/og/fonts/` because
  Satori reverses Arabic word order. An uploaded `og_image_path` wins.
- **Sitemaps**: `app/sitemap.ts` with `generateSitemaps` → `/sitemap/ar.xml`,
  `/sitemap/en.xml`, hreflang alternates per entry, listed in `app/robots.ts`;
  revalidated with the help pages on publish.
- **Redirects run in pages, not in `proxy.ts`**: the article and topic pages
  consult `help_redirects` (via `help_redirect_hit()`, which counts the hit)
  only after a slug fails to match; `help/[...legacy]` catches every other
  shape, then records the miss in `help_not_found` and sends the reader to
  search with the old slug as the query. Source/target are stored as *public*
  paths (`/ar/articles/…`) and mapped to internal hrefs by `resolveHelpTarget`.
- **Alt text is enforced on save** — a figure without alt fails validation.
- Lighthouse was not run in this environment; the on-page checklist (canonical,
  hreflang, meta, alt, JSON-LD, sitemap, robots) is verified by curl.

## Applying migrations

`scripts/apply-migrations.ts` (`npm run db:migrate`, add `--seed-help` for the
help seed) connects with `SUPABASE_DB_URL` from `.env.local`, records what it
ran in `public.app_migrations`, and recognises migrations applied before the
table existed by a marker object each one creates. **The production project is
the live roadmap** — it holds real features, votes and submissions — so
`seed.sql` (roadmap dev data, deletes first) is never applied there; only
`seed-help.sql` is. **Migrations already applied there are frozen**: 0001–0022
as of 2026-09-09. Add a new numbered file for any schema change.

The direct database host is IPv6-only and macOS `getaddrinfo` does not return
it to Node, so `SUPABASE_DB_URL` uses the **Session pooler** host
(`aws-1-eu-west-1.pooler.supabase.com`, user `postgres.<ref>`, port 5432).
PostgREST refreshes its schema cache a few seconds after DDL; a page loaded in
that window says "Could not find the table … in the schema cache" once.

### A feature can carry a picture (0022)

- `features.image_url` plus bilingual alt. It renders **inside the feature
  dialog, never on the board card** — a card is a title and a vote count, and
  a wall of screenshots is a different product. Asked for by the team.
- **Alt text is optional here, on purpose.** A roadmap card is not a published
  article, and refusing the save over a description would stop the work. The
  editor says so instead, and an empty description is the mark.
- The picture comes from the help center's media library, the same one the
  changelog editor writes to. One media store for the app.
- **Shipping carries it into the changelog draft** (`draftChangelogForFeature`),
  so the screenshot on the roadmap and the one in the announcement are the
  same file rather than two uploads that drift.

## Deliberately not built

Comments on entries (the one thing the reference has that this does not), and
email delivery — `notification_outbox` fills correctly but needs a provider and
a worker. Both are called out in the README rather than hidden.
