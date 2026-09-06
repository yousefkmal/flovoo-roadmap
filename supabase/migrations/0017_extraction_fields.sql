-- Phase 7B: the fields that decide whether a passage can be lifted out of an
-- article and used as an answer.
--
-- Retrieval systems judge a page largely on its opening. `answer_summary` is
-- that opening written deliberately: the direct answer, 40–70 words, in the
-- article's own language. It becomes the first paragraph a reader sees, the
-- meta description, and the JSON-LD `description` — one sentence maintained
-- once instead of three drifting copies.

alter table help_article_translations
  add column answer_summary  text,
  -- The same article titled the way a person would ask for it. Assistants
  -- match questions, not headlines.
  add column question_title  text,
  -- 3–6 short facts: limits, prices, prerequisites. Emitted as an ItemList.
  add column key_facts        jsonb not null default '[]'::jsonb,
  -- Facts go stale. This is when somebody should look again.
  add column review_due_at    timestamptz;

comment on column help_article_translations.answer_summary is
  'The direct answer, 40-70 words. Required to publish; rendered as the lead paragraph.';
comment on column help_article_translations.question_title is
  'Optional: the title phrased as a question a user would type.';
comment on column help_article_translations.key_facts is
  'Array of short strings. Rendered as "at a glance" and emitted as ItemList.';

alter table help_article_translations
  add constraint help_key_facts_is_array
    check (jsonb_typeof(key_facts) = 'array' and jsonb_array_length(key_facts) <= 6),
  add constraint help_answer_summary_length
    check (answer_summary is null or char_length(answer_summary) between 80 and 700),
  add constraint help_question_title_length
    check (question_title is null or char_length(question_title) <= 200);

-- "Which articles are due a look?" — the admin filter reads this.
create index help_translations_review_due_idx
  on help_article_translations (review_due_at)
  where review_due_at is not null;

-- Articles that cannot be published yet because nobody has written the answer.
create index help_translations_no_summary_idx
  on help_article_translations (article_id)
  where answer_summary is null;

-- Backfill: everything imported from Intercom is due a review six months from
-- its last edit. Nothing is invented — this is a reminder, not a claim.
update help_article_translations
   set review_due_at = updated_at + interval '6 months'
 where review_due_at is null;
