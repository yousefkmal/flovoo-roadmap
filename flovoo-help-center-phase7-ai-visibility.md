# Flovoo Help Center — Phase 7: AI Visibility (GEO) & AI Citation Tracking

> **How to use this file:** Share with Claude Code after Phase 6 is approved and the Intercom content is live. This phase makes Flovoo's help articles maximally discoverable, extractable, and citable by AI assistants (ChatGPT, Claude, Gemini, Perplexity, Copilot, Google AI Overviews) — with Arabic as the primary competitive advantage — and builds first-party tracking so we can see when AI systems read and cite us. **Build in sub-phases 7A → 7E and stop for review after each.**

---

## 1. Goal

When a user in the MENA region asks an AI assistant — in Arabic or English — a question that Flovoo's articles answer, we want Flovoo to be one of the cited sources, and over time a trusted default source for topics like WhatsApp Business API, unified inbox, customer conversation management, and related how-to content.

This is **GEO (Generative Engine Optimization)**: a layer on top of the SEO work from Phase 4, not a replacement. The success metric shifts from "ranking position" to **citation frequency in AI answers** and **AI-referred visits**.

**Why Arabic is the lever:** Arabic content is scarce online relative to Arabic speakers. AI systems answering Arabic questions draw from a thin pool of sources, so well-structured, authoritative Arabic help content has a disproportionately high chance of being retrieved and cited. Every recommendation below must be applied to the Arabic version *first*, then English.

---

## 2. Reality check (read before building)

Build on what the evidence supports, and don't oversell what doesn't:

- **What clearly works:** open access for AI search/retrieval crawlers; answer-first content structure (the first paragraph directly answers the question); FAQ and Article structured data; accurate `dateModified`; entity clarity (consistent brand naming); short extractable passages; content freshness. Perplexity and ChatGPT Search rely on real-time retrieval; Gemini/AI Overviews correlate with Google ranking; Claude favors well-structured logical content.
- **`llms.txt` has weak evidence as a ranking/citation signal.** AI search crawlers rarely fetch it and no major provider has committed to using it. We still ship it — it's nearly free, useful for AI coding agents and our own AI Agent, and a machine-readable brand identity layer — but we never justify effort by it or expect traffic from it.
- **Measurement is partial by nature.** Server logs show crawlers *retrieved* a page, not that it was *cited*. Many AI-referred visitors arrive with no referrer (mobile apps strip it) and appear as "Direct". Google AI Overviews traffic is indistinguishable from organic in analytics. We therefore build a three-layer picture (crawler retrieval, AI referrals, prompt-based citation checks) and report it honestly with the gaps labeled.
- **Crawlers must be verified, not trusted.** User-agent strings can be spoofed. Verify major crawlers via the operators' published IP ranges / reverse DNS before counting them.

---

## 3. Scope

### In scope (Phase 7)
- 7A — Crawler access policy & discoverability (robots per bot, sitemaps, IndexNow/Bing, llms.txt, markdown endpoints)
- 7B — Content structure for extraction (editor fields + template + validation + rendering)
- 7C — Entity & authority signals (Organization schema, About/brand page, consistent naming, attribution)
- 7D — Tracking: AI crawler log, AI referral detection, per-article AI signals, admin dashboard
- 7E — Citation monitoring: scheduled prompt checks against AI models, "share of answer" over time
- Content playbook for the team (Arabic-first) — delivered as `docs/geo-playbook.md`

### Out of scope
- Paid GEO/visibility SaaS tools (we build a lightweight first-party version)
- Off-site work (PR, third-party mentions, backlinks) — noted in the playbook as the team's job, not code
- Blocking/monetizing AI crawlers (Cloudflare pay-per-crawl etc.) — we want to be read

---

## 4. Sub-phase 7A — Crawler access & discoverability

1. **robots.txt rewrite, explicit per bot.** Replace the blanket rules with named blocks. Two classes:
   - **AI search / retrieval / user-triggered agents — ALWAYS ALLOW:** `OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`, `Perplexity-User`, `Googlebot`, `Bingbot`, `Applebot`, `DuckAssistBot`, `Amazonbot`, `Meta-ExternalAgent`/`Meta-ExternalFetcher`, `YouBot`, `MistralAI-User`.
   - **Training crawlers — decision in §10, default ALLOW:** `GPTBot`, `ClaudeBot`, `anthropic-ai`, `Google-Extended`, `CCBot`, `Bytespider`, `cohere-ai`. For a help center whose purpose is to be known by AI models, being in training data is desirable; the decision is Yousef's.
   - Keep the existing disallows for `/admin`, `/api` (except the agent read contract if we want it public), and search-result pages. Always end with `Sitemap:` lines for both language sitemaps.
   - Store the bot list in one config file (`config/ai-crawlers.ts`) with fields: token, operator, purpose (search|training|user-agent), verification method/IP-range URL. robots.txt, the log classifier (7D) and docs all read from this single list.
   - Add a CI check that fails if robots.txt would block `Googlebot`, `Bingbot`, or any search-class AI bot.
2. **Remove the launch `noindex` gate** (`NEXT_PUBLIC_HELP_INDEXABLE`) once `help.flovoo.com` is live — this phase assumes indexing is open; add an acceptance test that fails if any published article carries `noindex`.
3. **Bing + IndexNow.** ChatGPT Search and Copilot lean on Bing's index. Verify the site in Bing Webmaster Tools (Yousef does the verification; the code adds the verification meta/file). Implement **IndexNow**: on every publish/update/unpublish, ping IndexNow with the affected URLs (both languages). Log pings and responses in the admin.
4. **Google Search Console**: submit both sitemaps; add the verification method. (Yousef verifies.)
5. **`llms.txt`** at `/llms.txt`: brand summary (Arabic + English), what Flovoo is, links to collections and to every published article's markdown version, updated on publish. Plus `/llms-full.txt` with the full text of all published articles (Arabic first, then English). Both generated, never hand-edited.
6. **Markdown endpoints per article:** every article available as clean Markdown at `<article-url>.md` (and via `Accept: text/markdown` content negotiation). Include title, last updated, canonical URL, language, collection, and body — nothing else. This is the cheapest way to hand clean text to any agent or RAG pipeline.
7. **Accurate freshness signals:** `Last-Modified` and `ETag` HTTP headers on article pages matching the DB `updated_at`; JSON-LD `dateModified` must equal it exactly; sitemap `<lastmod>` likewise. Add a test.
8. **CDN/WAF sanity:** document how to verify that Vercel (and any future WAF) is not challenging or blocking the allowed bots; add a script `npm run check:ai-access` that fetches a sample article with each allowed bot's user agent and expects 200 + full HTML.
9. **"Copy page" menu beside the article title** (as on Mintlify-based docs sites such as Chatbase). A compact dropdown with:
   - Copy page (Markdown to clipboard — uses the `.md` endpoint from item 6)
   - View as Markdown (opens `<url>.md`)
   - Open in ChatGPT
   - Open in Claude
   - Open in Perplexity
   The AI options open the platform with a prefilled prompt containing the article's canonical URL. Prompt text follows the page language:
   - Arabic: `اقرأ هذه المقالة من مركز مساعدة فلوفو وجاوب على أسئلتي عنها: {url}`
   - English: `Read this Flovoo Help Center article and answer my questions about it: {url}`
   Keep the platform URL patterns in `config/ai-crawlers.ts` (they change occasionally). Mirror for RTL; collapse to an icon-only trigger on mobile. Track clicks per option (anonymous counter) and show them in the AI Visibility dashboard (7D) so we learn which assistants our customers actually use. Each click also produces a user-triggered fetch (`ChatGPT-User` / `Claude-User` / `Perplexity-User`) that 7D logs as a live retrieval.

---

## 5. Sub-phase 7B — Content structure for extraction

AI systems extract short, self-contained passages. Retrieval-based systems evaluate a page largely on its opening content. We enforce this through the editor, not through hoping writers remember.

1. **New per-translation fields** (schema migration, new numbered file):
   - `answer_summary` — 40–70 words, plain text, required at publish. The direct answer to the article's core question. Rendered as the first paragraph of the article (visually a lead paragraph, semantically the first `<p>` after `<h1>`), used as the meta description fallback, and as the `description` in JSON-LD.
   - `question_title` — optional alternate H1 phrased as the user would ask it (e.g., "كيف أربط رقم واتساب بفلوفو؟"). Used in JSON-LD `headline` alternates, `llms.txt`, and FAQ generation. If empty, fall back to the title.
   - `key_facts` — optional list of 3–6 short factual bullets (limits, prices, prerequisites, numbers). Rendered as a compact "باختصار / At a glance" block near the top and emitted as structured `ItemList` in JSON-LD.
2. **Editor guidance & validation** (admin):
   - Live checks with warnings (not blockers) beside the editor: summary length in range; first heading present within the first screen; paragraphs > 4 sentences flagged; at least one Q-style heading; steps used for procedures; FAQ block present for how-to articles; `key_facts` present when the article mentions a number/limit.
   - A **"GEO readiness" score** (0–100) per translation shown in the article list and editor, computed from the checks above. Purely advisory.
3. **Rendering rules:**
   - Headings become anchors already (Phase 1); additionally render each H2 section so that heading + first paragraph form a self-contained passage (no "as mentioned above" dependencies — flag in editor if the first paragraph of a section starts with a referring word like "كذلك / Also / As above").
   - FAQ blocks emit `FAQPage` JSON-LD (Phase 4) — extend to include `question_title` as an additional Q/A pair when present.
   - Definitions: a new small block type "تعريف / Definition" (term + one-sentence definition) rendered as `<dl>` and emitted as `DefinedTerm` in JSON-LD. Use for glossary-style content (WABA, BSUID, template, session window…).
4. **Arabic-specific:**
   - Enforce simplified فصحى in guidance text; English technical terms in parentheses at first mention — this is exactly how Arabic users phrase questions to AI assistants ("واتساب بيزنس API").
   - `question_title` guidance: write it as users type it in chat, not as a formal heading.
   - Make sure the normalizer (Phase 2) is also applied when generating `llms.txt` search hints, so hamza/ta-marbuta variants don't create duplicate entries.
5. **Freshness workflow:** add `review_due_at` (default: published_at + 6 months) and an admin filter "due for review". Editing and re-saving updates `updated_at` only if content actually changed (hash comparison) — never fake freshness.

---

## 6. Sub-phase 7C — Entity & authority signals

AI systems favor sources whose identity is unambiguous and consistent.

1. **Organization JSON-LD** on every help page: `Organization` (name "Flovoo" / "فلوفو", legal name Flovoo LLC, logo, url, `sameAs` → official social profiles, the main website, the roadmap portal), and `WebSite` with `publisher` → Organization. `TechArticle.publisher` → the same node (use `@id` references, one canonical Organization node).
2. **Consistent naming:** a single constants file for brand names in both scripts and product names; lint rule or test that the help UI and seed never use variants ("Flovoo CRM", "فلوفو كرم"…). Add to the GEO playbook: use the exact same product/feature names in every article as in the app UI.
3. **About / brand page** in the help center (`/help/about`): what Flovoo is, who it's for, regions, channels supported, link to roadmap and main site — written answer-first in both languages. This page is what an AI assistant reads when it asks "what is Flovoo?" before deciding whether to cite us.
4. **Attribution line** on articles: "من فريق فلوفو / By the Flovoo team" + last updated (no personal names — per company preference). Emit as `author` → Organization.
5. **Cross-linking:** related articles (Phase 2) plus a glossary page auto-built from Definition blocks; the roadmap "What's New" links to relevant help articles when a feature ships.

---

## 7. Sub-phase 7D — Tracking: crawler log, AI referrals, dashboards

Privacy-light and first-party, consistent with Phase 5.

1. **Crawler request log** (edge/middleware on help routes only):
   - Table `help_ai_crawler_hits`: `ts`, `bot_token` (from config), `operator`, `purpose`, `path`, `article_id` (resolved), `language`, `status`, `verified` (bool: IP matched operator range / reverse DNS), `ip_hash`.
   - Classify by user agent against `config/ai-crawlers.ts`; verify against published IP ranges where available (cache the ranges, refresh daily). Unverified matches are stored but flagged.
   - Sampling: none (volume is low for a help center); add a daily rollup table `help_ai_crawler_daily` (bot × article × day → count) for the dashboard.
   - **`ChatGPT-User`, `Claude-User`, `Perplexity-User` hits are the gold signal**: a real person's question caused that fetch — we treat them as "live retrievals" and surface them separately.
2. **AI referral detection** (extends Phase 5 view tracking): normalize referrer hostnames into an `ai_source` label — `chatgpt.com`, `chat.openai.com`, `claude.ai`, `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com`, `bing.com/chat`, `you.com`, `duckduckgo.com` (AI), `x.ai`/`grok`, `chat.deepseek.com`, `poe.com`, `mistral.ai`. Keep the list in the same config file. Store the label on `help_article_views`.
   - Add UTM-friendly handling: if an AI platform passes `utm_source`, honor it.
   - Note the known gap in the dashboard UI: "many AI visits arrive as Direct; this is a floor, not a total."
3. **Admin dashboard: "الذكاء الاصطناعي / AI Visibility"** (new tab beside Analytics):
   - Crawler retrievals over time by operator (stacked), split verified/unverified.
   - Live retrievals (user-triggered agents) — list of the most-retrieved articles this week with per-language split.
   - AI referrals by platform over time; top landing articles from AI.
   - Per-article table: retrievals (30d), live retrievals, AI referrals, GEO readiness score, last updated, review due.
   - "Never retrieved" list: published articles with zero AI crawler hits in 60 days → candidates for restructuring.
   - Robots/IndexNow health: last robots.txt validation, last IndexNow ping status, `check:ai-access` last run.
4. **Alerts (simple):** if a search-class bot gets ≥ 5% non-200 responses in a day, or robots.txt would block one, show a red banner in the dashboard and log it.

---

## 8. Sub-phase 7E — Citation monitoring ("share of answer")

Logs tell us we were *read*; only asking the models tells us we were *cited*.

1. **Question set**: table `help_geo_prompts` — 30–60 real questions our customers ask, Arabic and English, tagged by collection (seeded from zero-result searches, "not helpful" feedback, and the team's list). Editable in admin.
2. **Scheduled run** (weekly, cron/edge function): for each prompt, query the AI providers we have API access to with web search / browsing enabled where the provider supports it (Claude via Anthropic API with web search; add OpenAI/Perplexity/Gemini as keys become available). Record: `provider`, `prompt_id`, `answer_text` (stored for audit), `cited_domains[]`, `flovoo_cited` (bool), `flovoo_urls[]`, `position` (order of citation), `competitor_domains[]`, `ts`.
   - Keep provider adapters behind one interface; no provider is required for the phase to ship — the dashboard shows "not configured" per provider.
   - Respect provider ToS; keep volume small (≤ 60 prompts × providers per week).
3. **Dashboard section "الاستشهاد / Citations"**: share of answers citing Flovoo per provider per language over time; per-prompt table (cited? which URL? position); competitor domain frequency (who is being cited instead of us — this is the content roadmap); Arabic vs English gap.
4. **Manual audit helper:** a page that renders a prompt with a one-click copy so the team can spot-check in ChatGPT/Gemini/Perplexity UIs monthly and log the result by hand (dropdown: cited / not cited / cited wrong page).

---

## 9. Deliverable: `docs/geo-playbook.md` (Arabic-first, for the content team)

A short, practical guide the team uses when writing:
- The article template: question-style title → 40–70 word direct answer → key facts → steps/sections with self-contained passages → FAQ → related.
- Arabic writing rules for extraction: فصحى مبسطة, term (English) at first mention, numbers as Western digits, one idea per paragraph, no dialect.
- Freshness rules: review every 6 months; update real facts (limits, prices) the day they change.
- What code can't do: get mentioned on third-party Arabic tech sites, directories, YouTube descriptions, partner pages — consistent naming everywhere; answer questions in communities with links to articles. Entity consistency across the web is a ranking signal for AI systems.
- Monthly checklist: read the AI Visibility dashboard, restructure "never retrieved" articles, add prompts for new features, spot-check 5 prompts manually.

---

## 10. Open decisions (confirm before 7A)

1. **Training crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot):** **DECIDED — ALLOW.** Flovoo wants AI models to know its content; robots.txt allows all training crawlers listed in the config.
2. **Agent read contract (`/api/agent/v1/`)**: keep private (our AI Agent only) or open read-only to the web (lets any agent pull clean chunks; costs nothing but bandwidth). Recommended: keep private; markdown endpoints + llms-full.txt cover the public need.
3. **Which AI provider APIs to fund for 7E** (Anthropic already available; OpenAI, Perplexity, Google are optional additions).
4. **Bing Webmaster Tools / Search Console verification** — Yousef performs the account steps when the code is ready.

---

## 11. Acceptance criteria

1. `robots.txt` lists every bot from the config with explicit rules; CI fails if any search-class bot is blocked; `check:ai-access` returns 200 + full HTML for every allowed bot on a sample article in both languages.
2. Publishing an article triggers an IndexNow ping (logged) and regenerates `llms.txt`, `llms-full.txt`, both sitemaps, and the article's `.md` endpoint within seconds.
3. `Last-Modified`, JSON-LD `dateModified`, and sitemap `lastmod` are identical for every article (test).
4. Every published translation has an `answer_summary` in range; the article page's first `<p>` after `<h1>` is that summary; JSON-LD `description` equals it.
5. A request to an article with `User-Agent: ChatGPT-User` from a non-OpenAI IP is logged as *unverified*; from a published OpenAI range as *verified*. Both appear in the dashboard within a minute.
6. A visit with referrer `https://chatgpt.com/` is stored with `ai_source = chatgpt` and appears under AI referrals.
7. The weekly citation run stores results for every configured provider and the dashboard shows share of answer per language; unconfigured providers display "not configured", never zero.
8. Organization JSON-LD appears once per page with a stable `@id`; `TechArticle.publisher` and `author` reference it.
9. `docs/geo-playbook.md` exists, in Arabic first, and matches the editor checks.
10. No PII anywhere: IPs hashed, referrers reduced to hostnames, no prompt text tied to any visitor.
11. The "Copy page" menu appears beside every article title in both languages (mirrored in RTL, icon-only on mobile); "Copy page" copies the `.md` content; each AI option opens the platform with the language-appropriate prefilled prompt and the canonical URL; option clicks are counted in the AI Visibility dashboard.

---

## 12. Build order

- **7A** Access & discoverability (robots config, IndexNow, llms.txt, .md endpoints, freshness headers, access check script) → review.
- **7B** Content structure (fields, editor checks, GEO score, rendering, Definition block, review-due) → review. *Then the team backfills `answer_summary` for the migrated articles — Arabic first.*
- **7C** Entity & authority (Organization schema, About page, naming constants, attribution, glossary) → review.
- **7D** Tracking & dashboard → review.
- **7E** Citation monitoring + playbook → review.

Stop after each sub-phase. Report any assumption you had to make and anything in Phases 1–6 you needed to change.
