-- Phase 7D: what AI systems actually did.
--
-- Three layers, because no single one is the truth:
--   crawler hits   an AI system fetched a page. Not proof it was cited.
--   AI referrals   somebody arrived from an assistant. A floor, not a total:
--                  mobile apps strip the referrer and those arrive as Direct.
--   citations      7E asks the models directly. The only layer that shows
--                  citation rather than retrieval.
--
-- Privacy-light like Phase 5: addresses are hashed, referrers reduced to a
-- hostname, and nothing here can be tied back to a person.

create table help_ai_crawler_hits (
  id         uuid primary key default gen_random_uuid(),
  ts         timestamptz not null default now(),
  bot_token  text not null,
  operator   text not null,
  purpose    text not null,
  path       text not null,
  article_id uuid references help_articles (id) on delete set null,
  language   content_language,
  status     int not null default 200,
  -- User agents are trivially spoofed. Until the address is checked against
  -- the operator's published ranges this is a claim, not a fact.
  verified   boolean not null default false,
  ip_hash    text not null,

  constraint help_crawler_purpose check (purpose in ('search', 'training', 'user'))
);

create index help_crawler_ts_idx      on help_ai_crawler_hits (ts desc);
create index help_crawler_article_idx on help_ai_crawler_hits (article_id, ts desc);
-- The gold signal: a person asked an assistant about this page, just now.
create index help_crawler_live_idx    on help_ai_crawler_hits (ts desc) where purpose = 'user';

alter table help_ai_crawler_hits enable row level security;
create policy help_crawler_admin_all on help_ai_crawler_hits
  for all using (help_analytics_allowed()) with check (help_analytics_allowed());

-- A day of one bot on one article, for the dashboard. Volume is low enough
-- that nothing is sampled; this only saves the charts from scanning raw rows.
create table help_ai_crawler_daily (
  day        date not null,
  bot_token  text not null,
  article_id uuid references help_articles (id) on delete cascade,
  hits       int not null default 0,
  verified_hits int not null default 0,

  primary key (day, bot_token, article_id)
);

alter table help_ai_crawler_daily enable row level security;
create policy help_crawler_daily_admin_all on help_ai_crawler_daily
  for all using (help_analytics_allowed()) with check (help_analytics_allowed());

-- Which assistant sent a reader here, when the browser told us.
alter table help_article_views
  add column ai_source text;

create index help_views_ai_source_idx
  on help_article_views (ai_source, viewed_at desc) where ai_source is not null;

comment on column help_article_views.ai_source is
  'chatgpt | claude | perplexity | gemini | copilot | … from the referrer hostname. Null covers both "not from an assistant" and "the referrer was stripped", which is why this is a floor.';

-- ---------------------------------------------------------------------------
-- Recording
-- ---------------------------------------------------------------------------

create or replace function help_note_crawler_hit(
  p_bot_token text,
  p_operator  text,
  p_purpose   text,
  p_path      text,
  p_article   uuid,
  p_language  content_language,
  p_status    int,
  p_verified  boolean,
  p_ip_hash   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into help_ai_crawler_hits
    (bot_token, operator, purpose, path, article_id, language, status, verified, ip_hash)
  values
    (p_bot_token, p_operator, p_purpose, p_path, p_article, p_language, p_status, p_verified, p_ip_hash);

  insert into help_ai_crawler_daily (day, bot_token, article_id, hits, verified_hits)
  values (current_date, p_bot_token, p_article, 1, case when p_verified then 1 else 0 end)
  on conflict (day, bot_token, article_id) do update
    set hits = help_ai_crawler_daily.hits + 1,
        verified_hits = help_ai_crawler_daily.verified_hits + case when p_verified then 1 else 0 end;
end;
$$;

revoke all on function help_note_crawler_hit(text, text, text, text, uuid, content_language, int, boolean, text) from public;
grant execute on function help_note_crawler_hit(text, text, text, text, uuid, content_language, int, boolean, text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------

create or replace function help_ai_overview(days int default 30)
returns table (
  operator          text,
  purpose           text,
  hits              bigint,
  verified_hits     bigint,
  articles_touched  bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select h.operator,
         h.purpose,
         count(*)                                  as hits,
         count(*) filter (where h.verified)        as verified_hits,
         count(distinct h.article_id)              as articles_touched
    from help_ai_crawler_hits h
   where help_analytics_allowed()
     and h.ts >= now() - make_interval(days => days)
   group by h.operator, h.purpose
   order by count(*) desc;
$$;

/* Published articles no AI system has fetched: the restructuring list. */
create or replace function help_never_retrieved(days int default 60)
returns table (article_id uuid, title text, language content_language, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, t.title, t.language, t.updated_at
    from help_articles a
    join help_article_translations t on t.article_id = a.id
   where help_analytics_allowed()
     and a.status = 'published'
     and not exists (
       select 1 from help_ai_crawler_hits h
        where h.article_id = a.id
          and h.ts >= now() - make_interval(days => days)
     )
   order by t.updated_at desc;
$$;

revoke all on function help_ai_overview(int) from public;
revoke all on function help_never_retrieved(int) from public;
grant execute on function help_ai_overview(int) to authenticated, service_role;
grant execute on function help_never_retrieved(int) to authenticated, service_role;
