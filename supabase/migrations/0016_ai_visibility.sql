-- Phase 7A: the two things the access layer needs to remember.
--
-- Nothing here holds personal data. The ping log is our own outbound requests;
-- the click counter is a tally with no visitor attached to it.

-- ---------------------------------------------------------------------------
-- IndexNow pings
-- ---------------------------------------------------------------------------
-- Bing (and therefore Copilot and ChatGPT Search) indexes far faster when told
-- a URL changed than when waiting to be crawled. Every publish pings; this is
-- the record of whether the ping landed, so the dashboard can show a failing
-- integration instead of silently not working.

create table help_indexnow_pings (
  id          uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  urls        text[] not null,
  status_code int,
  ok          boolean not null default false,
  error       text,

  constraint help_indexnow_urls_not_empty check (cardinality(urls) > 0)
);

create index help_indexnow_recent_idx on help_indexnow_pings (submitted_at desc);

alter table help_indexnow_pings enable row level security;
create policy help_indexnow_admin_all on help_indexnow_pings
  for all using (help_analytics_allowed()) with check (help_analytics_allowed());

-- ---------------------------------------------------------------------------
-- "Ask an assistant about this page" clicks
-- ---------------------------------------------------------------------------
-- Which assistant our readers actually reach for, per article and language.
-- A counter, not an event log: there is no visitor, no session, nothing to
-- tie a row back to a person.

create table help_assistant_clicks (
  article_id uuid not null references help_articles (id) on delete cascade,
  language   content_language not null,
  target     text not null,
  clicks     int not null default 0,
  updated_at timestamptz not null default now(),

  primary key (article_id, language, target),
  constraint help_assistant_target check (target in ('copy', 'markdown', 'chatgpt', 'claude', 'perplexity'))
);

alter table help_assistant_clicks enable row level security;
-- Anyone may add to the tally; only admins may read it.
create policy help_assistant_clicks_admin_read on help_assistant_clicks
  for select using (help_analytics_allowed());

create or replace function help_note_assistant_click(
  target_article uuid,
  target_language content_language,
  target_name text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into help_assistant_clicks (article_id, language, target, clicks)
  values (target_article, target_language, target_name, 1)
  on conflict (article_id, language, target)
  do update set clicks = help_assistant_clicks.clicks + 1, updated_at = now();
$$;

revoke all on function help_note_assistant_click(uuid, content_language, text) from public;
grant execute on function help_note_assistant_click(uuid, content_language, text)
  to anon, authenticated, service_role;
