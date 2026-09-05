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
npm run seed:sql   # regenerate supabase/seed.sql from src/lib/data/seed.ts
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
| `features` | the board. Bilingual title/description, `status`, `vote_count`, `is_pinned`, `source`, `shipped_at` |
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

The guard sits in two places on purpose: the admin layout gates the pages, and
every admin action re-resolves the session itself. A Server Action is a reachable
endpoint whether or not a page renders a button for it.

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

## Gotchas this codebase has already paid for

- **`animate-fade-up` with `fill-mode: both`** pinned opacity at 0 in hidden
  tabs where animations never advance. Animate transform only.
- **dnd-kit needs a stable `DndContext id`** or its generated `aria-describedby`
  hydrates mismatched on every draggable.
- **`next/og` reverses Arabic word order.** Share cards are rendered from
  `tools/og-card.html` in a real browser and committed as PNGs. Do not move them
  back to a route.
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

## Deliberately not built

Comments on entries (the one thing the reference has that this does not), and
email delivery — `notification_outbox` fills correctly but needs a provider and
a worker. Both are called out in the README rather than hidden.
