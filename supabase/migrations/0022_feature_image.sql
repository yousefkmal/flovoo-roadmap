-- A picture for a roadmap feature.
--
-- The team asked for one image per feature, shown inside the feature's dialog
-- rather than on the board card — a card is a title and a vote count, and a
-- screenshot on it would turn the board into a gallery. The same image is
-- carried into the changelog draft when the feature ships, so nobody uploads
-- the same screenshot twice.
--
-- Alt text is bilingual and optional here, deliberately. A roadmap card is not
-- a published article: blocking the save would stop the work for a screenshot
-- that may never be seen by a reader. An image with no description shows as
-- incomplete in the admin instead, which is the same treatment help center
-- images get.

alter table features
  add column image_url    text,
  add column image_alt_ar text,
  add column image_alt_en text;

comment on column features.image_url is
  'A screenshot shown in the feature dialog, and copied into the changelog draft on ship. Same media library as the help center.';
comment on column features.image_alt_ar is
  'Arabic alt text. Optional: an empty description is shown as incomplete in the admin, never blocked.';
