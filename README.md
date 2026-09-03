# Flovoo Public Roadmap & Feedback Portal

Arabic-first (RTL) public roadmap and feedback portal for **Flovoo**, built to run
standalone at `roadmap.flovoo.com`.

Built against `flovoo-roadmap-portal-build-prompt.md` and styled with the
**Flovoo Design System v1.1**.

- **Phase 1 — done:** data model, roadmap board, Updates (changelog) tab,
  language switching, light/dark design system.
- **Phase 2 — done:** accounts, voting, idea submission, per-feature
  notification opt-in, confirmation states, anti-spam.
- **Phase 3 — done:** the admin dashboard — board manager, item editor,
  moderation queue, merge.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, React 19, Turbopack) |
| Language | TypeScript, strict |
| Styling | Tailwind CSS v4, design-system tokens in `src/app/globals.css` |
| Icons | Lucide only, 20px in nav/buttons, 16px inline, stroke 2 |
| Fonts | Plus Jakarta Sans (UI), Noto Sans Arabic (Arabic), JetBrains Mono (counts) |
| Animation | `motion` (the drawer); CSS for everything else |
| Data | Supabase (Postgres) — with a local seed fallback |

## Running it

```bash
npm install
npm run dev        # http://localhost:3000 → redirects to /ar or /en
```

| Script | |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build (also typechecks) |
| `npm run lint` | eslint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed:sql` | regenerate `supabase/seed.sql` from `src/lib/data/seed.ts` |

## Pages

Two tabs, both public and read-only in Phase 1:

- **`/[locale]`** — the board. Four stages (Under review · Planned · In
  progress · Shipped), a category filter, search, and a detail modal.
- **`/[locale]/updates`** — the changelog, newest first.

## Voting and submissions

Both are Server Actions in `src/app/[locale]/actions.ts`. Every action
re-validates its input — the client runs the same rules from
`src/lib/validation.ts` for instant feedback, but that copy is trivially
bypassed.

**Accounts.** Voting and submitting require signing in — with Google in one
press, or an email magic link. No passwords: a roadmap portal has no business
holding one.

This overrides §6 of the brief, which asked for lightweight name+email identity
and warned that "friction kills participation". That is a real cost and it was
taken deliberately: an account is what makes it possible to tell someone the
thing they asked for has shipped. Expect fewer votes and better-qualified ones.

**Notifications.** Two levels, because they answer different questions:

- Per feature: *Notify me when it ships*, in the detail panel.
- Per person: everything we ship / only what I follow / nothing, in the account
  menu. It sits there rather than behind a settings route because it is the only
  preference there is, and one switch behind a route never gets found.

A vote counts as interest too, so someone who voted is told without having to
follow separately. `enqueue_shipped_notifications` resolves that audience in one
place and writes to `notification_outbox`; deciding at write time means "who
should have been told" stays answerable afterwards and a failed send is
retryable without recomputing anything. **Delivery itself is not wired up** —
the outbox fills, and draining it needs an email provider.

**Voting.** The count moves the instant the button is pressed and rolls back if
the server refuses — a board that waits for a round trip to acknowledge a click
feels broken. Pressing again retracts the vote; the unique index on
`(feature_id, user_id)` is what actually guarantees one per person. Someone
signed out gets the sign-in dialog rather than a refusal.

**Submissions** go to the `submissions` table with `status = 'pending'` and never
touch the public board — an admin approves them in Phase 3.

**Anti-spam**, three layers:

- A honeypot field, off-screen and `tabindex="-1"`. When it is filled the action
  returns *success* and stores nothing, so a bot learns nothing from being
  refused and the sender's quota is untouched.
- A sliding-window limiter in process memory: 3 submissions per email per hour,
  10 per IP per hour, 60 votes per identity per hour. IPs are hashed, never
  stored in the clear.
- A database count for submissions, because the in-memory window only covers one
  instance and this is the limit that has to hold across a fleet.

**Rendering.** Both routes are now server-rendered per request rather than
prerendered. Vote counts move, and which items *this* visitor voted for is
theirs alone; reading the voter cookie is what opts the routes into dynamic
rendering, which is the right trade for personalised content.

**Without Supabase** the portal is still fully usable. Votes, follows and
submissions are kept in process memory (`src/lib/data/local-store.ts`), and
email sign-in is stubbed (`src/lib/auth/dev-session.ts`) so the whole flow —
sign in, vote, follow, submit — can be exercised with no setup. The stub accepts
any address without verification, which is exactly as insecure as it sounds, so
it refuses to run in production and switches itself off the moment Supabase is
configured. Google sign-in is disabled in that mode and says so on the button.

**To enable real accounts**, see `.env.example`: add the Supabase keys, then in
the dashboard add Google's OAuth credentials and register the callback URLs
(`/{locale}/auth/callback`).

## Data

The schema lives in `supabase/migrations/0001_init.sql` — tables, enums, RLS
policies, vote-count triggers, and the `merge_features` RPC. `supabase/seed.sql`
is **generated** from `src/lib/data/seed.ts`; edit the TypeScript and re-run
`npm run seed:sql` so the two can never drift.

Everything reads through `src/lib/data/repository.ts`, which uses Supabase when
it is configured and the local seed otherwise. To point the portal at a real
database:

See `.env.example`. In short:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server only, never exposed
VOTER_ID_PEPPER=<a long random string>          # required in production
```

Then apply the migration and seed:

```bash
supabase db push && psql "$DATABASE_URL" -f supabase/seed.sql
```

No other code changes are needed — the fallback switches off on its own.

Admins are rows in `admin_users` keyed by `auth.users.id`; every admin RLS policy
goes through the `is_admin()` security-definer function.

## Design system

Two sources, deliberately split.

**From the reference portal** (measured off the live page, not approximated):
the surfaces, the stage colours and icons, the type scale, and the shape of the
badges, chips, counts and vote pill. This is what the portal is asked to look
like.

**From the Flovoo system**: brand identity and the rules it marks as
never-violate — the gradient CTA, the wordmark, Flovoo Blue for links and the
active tab, Lucide as the only icon set, navy-tinted dark surfaces, navy-tinted
shadows.

Where the two disagree, the split is noted below. Everything not in either is
*derived* rather than hand-picked, and commented where it is defined:

- **Stage colours** are the reference's: a 50-level tint, a 600-level label and
  a 400-level icon per stage — purple, amber, blue, green. Two labels step one
  stop down their ramp because the reference's own values fail AA at 12px:
  yellow-600 measures 2.84:1 on its tint and green-600 3.0:1. Tints and icon
  colours are untouched, so the board reads the same.
- **Stage icons** are the Lucide equivalents of the reference's glyphs — Atom,
  FastForward, Zap, CircleCheck. The Flovoo system allows one icon set only, so
  these are matched by shape rather than copied.
- **Type scale** is the reference's: 24/700 page title, 16/400 lede, 14/600 card
  title, 12/600 badges, 12/500 chips.
- **Dark mode** keeps Flovoo's navy-tinted surfaces — the reference's dark page
  is a near-black neutral, and "navy-tinted, never gray" is one of the system's
  never-violate rules. The stage colours still follow the reference: the hue at
  12% over the card, with a 400-level label and icon.

### The board's three layers

The board is not cards on a page — it is **page → column panel → card**, and
that is what makes a column read as a group and a card as an object inside it.
In the reference the panel is an absolutely-positioned sibling behind each
column, which is easy to miss when reading computed styles one element at a
time; it shows up when you sample the painted stack with `elementsFromPoint`.

Here the panel is simply the column's own background, which gets the same result
without the absolute positioning.

| Layer | Light | Dark |
|---|---|---|
| Page | `#FFFFFF` | `#0E1220` |
| Column panel | `#FAFBFD` | `#151A2B` |
| Card | `#FFFFFF` + `#DEE1EA` border | `#1D2337` |

Light matches the reference exactly. Dark keeps the same size of step between
layers, in Flovoo's navy rather than the reference's near-black, because
"navy-tinted, never gray" is one of the design system's never-violate rules.
Panel and card share the reference's 10px corner.

### Theme

Three settings — **Auto** (the default), Light and Dark — from a menu in the
header, matching the filter menu's interaction.

- The dark tokens live in one block keyed off `:root[data-theme="dark"]` rather
  than a `prefers-color-scheme` media query, so the OS and the visitor's own
  choice resolve to a single value and a token can't be updated in one theme and
  forgotten in the other.
- An inline script in `<head>` resolves the theme before first paint, so the
  page never renders light and flips. `<html>` carries `suppressHydrationWarning`
  because that script writes an attribute React did not render.
- The preference is read with `useSyncExternalStore`, not copied into state in an
  effect: the server snapshot stays honest and a change made in another tab is
  picked up.
- On Auto the OS stays the source of truth and is followed live if it changes
  mid-session. `color-scheme` tracks the resolved theme so native controls and
  scrollbars match.
- Every read and write of `localStorage` is guarded — it throws in some privacy
  modes, and a theme toggle must not take the page down with it.
- **Links and the active tab** use the system's hover blue `#3D55D6` on light —
  Flovoo Blue itself is 4.35:1 on white, just under AA at label sizes.
- **Two content tracks.** Prose keeps the system's 1160px; the board gets 1320px
  (`--container-board`). Four columns at 1160 leave 255px each, which wraps most
  titles onto three lines.

### The logo

`FlovooLogo` renders the wordmark only. The system ships the chevron as an asset
(`flovoo-mark.svg`) that is not in this repo, and inventing a stand-in would put
a wrong glyph in front of customers. Drop the real file in and place it before
the wordmark.

### Known conflict: white on the brand gradient

The gradient is a hard constraint and is used verbatim, exactly once per view,
on the primary CTA. White text on it measures:

| Position along the gradient | Contrast vs white |
|---|---|
| `#2EA8FF` (sky, 0%) | 2.57:1 |
| 30% | 3.57:1 |
| `#4D6BFB` (blue, 50%) | 4.36:1 |
| `#7A5AF8` (violet, 100%) | 4.52:1 |

A button-sized CTA therefore renders its label between roughly 3.4:1 and 4.5:1 —
under WCAG AA. This is a system-level decision, not an app-level one, so the
gradient has been left untouched. Two ways to close it:

- Deepen the gradient's sky stop system-wide — `#1A6FB5` reaches 5.27:1, while
  `#1F84D6` only reaches 3.94:1 and is not enough.
- Keep the gradient for large brand surfaces and use the system's solid
  `#3D55D6` for small CTAs (6.05:1).

## Updates behaviour

Modelled on the reference portal's changelog, measured the same way as the board:

- **Each entry is a sticky rail beside its content.** The rail is 200px on `md`
  and up, holding the date above the tags and staying put as the entry scrolls.
  Below `md` it collapses into one row above the content — date at the start,
  tags at the end.
- **Two tags per entry**: the kind of change (New / Improved / Fixed) and the
  part of the product it touched, each 12px/500 on a tint with a 4px corner.
- **Long entries collapse** to 260px behind a fade and a "Continue reading"
  control. Short ones render plainly with nothing to press; the height is
  measured, and re-measured on resize because the same text wraps differently at
  another width.
- **Search and the kind filter are desktop-only**, matching: on a phone the list
  is short enough to scroll and the controls cost more room than they save.
- **Emoji reactions** show only what someone has actually used, plus one button
  to add another. Showing all five on every entry turns a quiet row into a
  demand.
- **Subscribe** sets the account's notification scope to everything. Pressing it
  again returns to following-only rather than to silence, so unsubscribing here
  never discards follows made on the board.
- **A cover image per entry**, sized 2:1 with `width`/`height` set so the page
  does not reflow as they load, and lazy-loaded below the fold. Alt text is a
  column on the table in both languages, not an afterthought — a cover that
  carries meaning has to carry it to everyone.
- **Two optional links per entry**, independent of each other, so an entry can
  carry neither, either, or both:
  - `article_url` renders a **Read more** link to the full write-up.
  - `action_url` renders an **Explore it now** button to the feature in the
    product. `action_label_*` overrides the wording, because "Explore it now" is
    not always right — "Connect Instagram" or "Open saved replies" says more.

  Both open in a new tab with `rel="noopener noreferrer"` and an announced
  "opens in a new tab". The action button is bordered rather than gradient: the
  design system allows one gradient CTA per view, the subscribe button has it,
  and a feed of gradient buttons stops meaning anything.

  Schemes are checked twice — a database constraint on write and
  `isSafeHttpUrl` on render — because these are admin-entered strings that
  become an `href`, and `javascript:` in an href executes.
- **Permalinks and RSS.** Each entry carries an id and a copy-link control, and
  `/{locale}/updates/feed.xml` serves the feed the RSS icon points at, with the
  cover attached as an enclosure.

### About the cover images

`public/updates/*.svg` are Flovoo-branded illustrations authored for this repo,
not screenshots: each one shows the shape of what the entry describes. They are
SVG on purpose — a few KB, no third-party host, no image-optimisation config,
and sharp at any width.

**They are placeholders for real product screenshots.** A changelog is more
convincing with the actual thing in it; swap `image_url` on the entry and update
the two alt columns when you have them.

Two deliberate departures from the reference:

- **Dates stay locale-appropriate.** The reference writes "August 24th, 2026";
  that ordinal form does not exist in Arabic, and this is an Arabic-first
  product. Both locales get their own correct format.
- **Comments are not built.** The reference threads comments under each entry.
  Ours has the `comments` table and nothing else — a comment system needs
  moderation and admin tooling, which is Phase 3 work, and a half-built comment
  box would be worse than none.

## Board behaviour

Modelled on the reference portal the brief points at:

- **Four stages**: Under review · Planned · In progress · Shipped. Shipped also
  has its own tab, where the full changelog carries release notes; the column
  is the last few, in board context.
- **Mobile stacks the columns** full width, one after another, and lets the page
  scroll. No tabs and no swiping — every stage is reachable by scrolling, and
  nothing is hidden behind a control the visitor has to discover.
- **From `md` all four sit on a single row** — never some above and some below.
  Each holds a 20rem floor and the row scrolls sideways when they do not fit; at
  `xl` they share the width and the scrolling stops. The scroller and the flex
  row are two elements on purpose: make one element both and the overflow leaks
  onto the page.
- **One order, no sort control.** Pinned first, then most voted, then newest —
  except in Shipped, which reads by ship date: once a thing exists, "when did it
  land" is the question, not "how many people asked for it".
- **Search and the category filter are collapsed to icons** and open in place.
  They behave identically at every width, so nothing is hidden behind a
  different interaction on mobile. Escape or a press outside closes them; an
  active filter is reflected on its button.
- **The status header is sticky inside its column** in both layouts, so the
  stage you are reading stays labelled.
- **Cards carry title, one meta row and the vote pill** — the title clamps to
  three lines and underlines on card hover. The description is not on the card;
  it is what turns a board into a wall of text.
- **Detail opens as a centred modal**, not a side panel: the post on the main
  side, a meta rail beside it (votes, status, category, dates, author), and
  previous/next controls so you can walk the board without going back to it.
  Previous/next follow reading order — column by column, top to bottom.
  Below `lg` the rail stacks under the content and the three controls collapse
  into the panel's own top bar.

## Bilingual & RTL

- Arabic is the default. Every route is `/[locale]`, and `lang` + `dir` are set on
  `<html>` — no client-side direction patching.
- `/` redirects via `src/proxy.ts`: saved cookie → `Accept-Language` → Arabic.
  The choice is persisted in the `flovoo_locale` cookie for a year.
- UI strings live in `src/i18n/dictionaries/`. The English dictionary is typed
  against the Arabic one, so a missing key fails the build.
- Copy follows the system's voice: direct, calm (no exclamation marks in product
  UI), human. Arabic is modern standard and deliberately not Egypt-only, so it
  reads the same in the Gulf.
- Layout uses logical properties throughout (`ms-`, `pe-`, `start-`, `end-`).
- The board keeps its search, category, sort, and open item in the query string,
  so switching language swaps only the locale segment and lands the visitor
  exactly where they were.
- Dates render with Arabic month names and Western digits (`ar-EG-u-nu-latn`),
  formatted on the server so client and server can't disagree.
- `.numeral` forces LTR and is for **standalone** numbers only. Strings that mix
  Arabic words with digits use `.numeric`, which aligns figures without touching
  direction — forcing direction there reorders the sentence.

## Layout

```
src/
  app/[locale]/         layout (html lang/dir, fonts, metadata)
    page.tsx            the board
    updates/page.tsx    the changelog
  proxy.ts              locale redirect for bare paths
  i18n/                 config, dictionaries, interpolation helper
  lib/
    types.ts            domain types, 1:1 with the schema
    data/               seed, Supabase client, repository (the only read path)
    view.ts             server-built view model for the board
    format.ts           locale-aware dates, "New" cut-off
    status.ts           status → badge variant + icon, and the status flow
  components/
    roadmap/            board, column, card, toolbar, modal
    updates/            changelog feed
    ui/                 chip, badge, vote button, empty state
supabase/               migration + generated seed
scripts/                seed.sql generator
```

## Accessibility notes

Every text/background pair on both pages was measured in both themes; all clear
WCAG AA, with the single documented exception of the gradient CTA above.

- The board card exposes exactly two controls — vote and open — and no nested
  buttons: the title button stretches over the card rather than the card itself
  being one.
- The modal traps Tab, closes on Escape, and restores focus to its opener.
- The timeline shows state as filled vs. outline rather than a glyph inside the
  dot: white on the amber of "in progress" is 2.4:1, below the 3:1 that a
  meaningful graphic needs.
- Card entrance animates transform only, never opacity — browsers don't advance
  animations in a hidden tab, so an opacity fade renders blank in prerenders and
  link previews.
- The icon-only CTA on mobile keeps its name via `sr-only`, not `hidden`.
- The category menu is a real `menu` with `menuitemradio` options and Up/Down
  navigation; both toolbar controls return focus to their button on Escape.
- The primary CTA is live and answers the press with a note rather than sitting
  disabled — a greyed-out primary action reads as broken, not as "not yet".

## The admin dashboard

`/[locale]/admin`, gated on an admin session.

**Who is an admin.** `ADMIN_EMAILS` is the bootstrap list — something has to
grant the first one, and it cannot be the admin table. After that, `admin_users`
is the roster, and it is what every RLS policy checks through `is_admin()`.

**The guard is in two places on purpose.** The layout gates the pages, and every
admin action re-resolves the session itself. A Server Action is a reachable
endpoint whether or not a page renders a button for it, so guarding only the
pages would leave the actions open.

**Board manager.** All five stages including Archived. Cards move by drag, and
every card also carries a move menu — drag is a pointer gesture, and an admin on
a keyboard needs the same power. Moving something to Shipped queues the
notifications for everyone who followed or voted for it, and the board says how
many were queued in a live region rather than doing it silently.

**Item editor.** Arabic and English side by side rather than behind a language
toggle, because the board renders both and writing one without the other is the
mistake the form should make hard — the server refuses a half-translated save.
Below the form, the public card is previewed in both languages, each in its own
direction, updating as you type: the only way to catch a title that wraps badly
in one language and not the other.

**Moderation queue.** Approve, merge, reject, with a badge in the nav carrying
the backlog. Each outcome asks for only what it needs: rejecting takes a note,
merging takes a search, approving takes the missing translation. An approved
submission becomes a real feature; a merged one repoints; a rejected one keeps
its internal note, which the sender never sees.

**Merge** transfers the votes the target does not already have and archives the
duplicate rather than deleting it — an archived row keeps the history.

**Stats header.** Four numbers and a top-five list, derived from the features
the board has already loaded rather than counted in a second round trip. Only
"waiting for review" is a link: a number an admin should act on is worth a
click, and the rest are context. Submission counts do need their own query,
since the board holds features and not submissions.

**Changelog manager.** `/[locale]/admin/changelog`. Drafts sort above published
entries — the unpublished ones are the to-do list, and a manager that buries
them under everything already shipped hides its own work. Publish and unpublish
toggle in place with an optimistic flip, so the row responds before the round
trip resolves.

**Auto-drafting.** Moving a feature to Shipped writes a changelog entry carrying
its bilingual title and description, **unpublished**, tagged in the manager with
"drafted automatically when the feature shipped". The system writes the first
version, a person approves it — shipping should not publish prose nobody read.
It is idempotent: shipping the same feature twice drafts once.

**Entry editor.** The same bilingual side-by-side shape as the item editor, plus
kind, linked feature, cover image with alt text per language, and the two
optional links — the "read more" article and the "explore it" button. Both URLs
are re-validated on the server and dropped if they are not `http(s)`; the client
input is a convenience, not the check.

## Still to come

- **Email delivery.** `notification_outbox` fills correctly on every ship, but
  nothing drains it — that needs a provider and a worker.
- **Comments.** Still deferred, and the one thing in the Featurebase reference
  we do not have. The `comments` table exists and the UI notes it.

**The seed link URLs are placeholders.** `help.flovoo.com` and `app.flovoo.com`
do not resolve. Replace them before this is shown to anyone.
