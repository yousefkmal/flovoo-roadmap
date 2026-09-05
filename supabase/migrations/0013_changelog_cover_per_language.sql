-- A cover image per language.
--
-- Intercom kept a cover for each language of an announcement, and 21 of the 54
-- imported from it differ between the two — an Arabic screenshot and an English
-- one of the same screen. `image_url` was a single shared column, so English
-- readers were being shown the Arabic picture.
--
-- Arabic is the product default here, so `image_url` stays the cover and
-- `image_url_en` is an override used only when the English version has its own.
-- An entry with one cover for both languages needs no second value, which is
-- the common case and keeps the editor from asking for two uploads every time.

alter table changelog_entries
  add column image_url_en text;

comment on column changelog_entries.image_url_en is
  'English cover, when it differs from image_url. Null means English uses image_url.';
