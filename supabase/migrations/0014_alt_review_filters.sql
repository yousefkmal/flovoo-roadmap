-- "Which of these still have a machine-written description?"
--
-- Alt text is marked unreviewed in two places (see 0011): `altDraft` on a
-- figure inside a body, and `alt_needs_review` on a media row. Neither is
-- answerable from a list query without reading every body, so the answer is
-- derived here and the admin lists filter on it.
--
-- `jsonb_path_exists` is immutable, so these are stored generated columns:
-- always right, never maintained by hand, and cheap to filter on.

alter table help_article_translations
  add column has_draft_alt boolean
  generated always as (jsonb_path_exists(body, '$.**.altDraft ? (@ == true)')) stored;

create index help_translations_draft_alt_idx
  on help_article_translations (article_id) where has_draft_alt;

alter table changelog_entries
  add column body_has_draft_alt boolean
  generated always as (
    jsonb_path_exists(coalesce(body_ar, '{}'::jsonb), '$.**.altDraft ? (@ == true)')
    or jsonb_path_exists(coalesce(body_en, '{}'::jsonb), '$.**.altDraft ? (@ == true)')
  ) stored;

-- A cover's alt lives on the entry itself, not in a body, so it needs its own
-- flag. Set when a description is generated; cleared when somebody edits the
-- alt field in the editor — the same rule the figure badge follows.
alter table changelog_entries
  add column cover_alt_needs_review boolean not null default false;

comment on column changelog_entries.cover_alt_needs_review is
  'True while image_alt_ar / image_alt_en are machine-written and unreviewed.';

create index changelog_alt_review_idx
  on changelog_entries (cover_alt_needs_review) where cover_alt_needs_review;
