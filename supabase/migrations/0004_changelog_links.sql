-- Optional links on a changelog entry.
--
-- Two different jobs, so two columns rather than one:
--   article_url  — "read more", pointing at the full write-up elsewhere
--   action_url   — "explore it", pointing at the feature itself in the product
--
-- Both are optional and independent: an entry may carry neither, either, or
-- both. The action label is overridable because "Explore now" is not always the
-- right words — sometimes it is "Open settings" or "Connect a channel".

alter table changelog_entries
  add column article_url text,
  add column action_url text,
  add column action_label_ar text,
  add column action_label_en text;

-- Only ever http(s). These are typed in by an admin and rendered as an href, so
-- the database is the right place to refuse `javascript:` and friends rather
-- than trusting every caller to remember.
alter table changelog_entries
  add constraint changelog_article_url_scheme
    check (article_url is null or article_url ~* '^https?://'),
  add constraint changelog_action_url_scheme
    check (action_url is null or action_url ~* '^https?://');
