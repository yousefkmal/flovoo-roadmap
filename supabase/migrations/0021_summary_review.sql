-- Draft answer summaries, marked so a reader never sees one nobody approved.
--
-- The 38 published articles were written before Phase 7B, so every one of them
-- has an empty `answer_summary` — the one extraction field publishing requires.
-- Writing 76 of them by hand is the kind of work that never gets done, so they
-- are drafted in bulk and marked here instead.
--
-- The rule is the alt-text rule (0011), applied to a different field: a draft
-- counts as *absent* everywhere a reader could see it. The public article page,
-- the `.md` endpoint and `llms.txt` fall back to the excerpt; the meta
-- description falls back too; publishing still refuses to treat it as written.
-- Editing the field in the editor — or pressing "approve" — clears the flag,
-- and only then does the summary become the article's opening paragraph.

alter table help_article_translations
  add column summary_needs_review boolean not null default false;

comment on column help_article_translations.summary_needs_review is
  'True while answer_summary is machine-drafted and unreviewed. Treated as no summary at all until cleared.';

-- "Show me the ones still waiting on me." The admin list filters on this.
create index help_translations_summary_review_idx
  on help_article_translations (article_id) where summary_needs_review;
