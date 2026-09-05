-- Alt text that a machine wrote and nobody has checked yet.
--
-- The Intercom migration brought in 202 pictures with no alt text at all.
-- Writing 202 descriptions by hand before anything can be published is the
-- kind of task that ends with empty strings typed to get past validation, so
-- the descriptions are generated and then reviewed — but a generated
-- description must never be mistaken for an approved one.
--
-- Two places record that, because alt text lives in two places:
--   help_media.alt_needs_review   the library's copy, per picture
--   the figure node's `altDraft`  the body's copy, per use of that picture
--
-- The body's copy is what a reader gets, so it is the one publishing checks.
-- The column here is what makes the media library able to show the same badge
-- and lets an editor find every unreviewed picture in one query.

alter table help_media
  add column alt_needs_review boolean not null default false;

comment on column help_media.alt_needs_review is
  'True when alt_ar / alt_en were generated rather than written by a person. Publishing an article refuses figures whose alt is still marked draft.';

-- The unreviewed ones are the working list; nothing else queries this column.
create index help_media_alt_review_idx on help_media (alt_needs_review) where alt_needs_review;
