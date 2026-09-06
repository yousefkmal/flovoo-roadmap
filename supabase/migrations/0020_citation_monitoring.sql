-- Phase 7E: the only layer that shows citation rather than retrieval.
--
-- Logs tell us a page was read. Asking the models tells us whether they
-- answered with it. Everything else in Phase 7 is a proxy for this.

create table help_geo_prompts (
  id         uuid primary key default gen_random_uuid(),
  prompt     text not null,
  language   content_language not null,
  /** The topic this question belongs to, for grouping the results. */
  collection_id uuid references help_collections (id) on delete set null,
  is_active  boolean not null default true,
  /** Where it came from: a zero-result search, unhelpful feedback, the team. */
  source     text not null default 'team',
  created_at timestamptz not null default now(),

  constraint help_prompt_length check (char_length(prompt) between 8 and 400),
  constraint help_prompt_source check (source in ('team', 'zero_result', 'feedback'))
);

create index help_prompts_active_idx on help_geo_prompts (is_active, language);

alter table help_geo_prompts enable row level security;
create policy help_prompts_admin_all on help_geo_prompts
  for all using (help_analytics_allowed()) with check (help_analytics_allowed());

create table help_geo_runs (
  id         uuid primary key default gen_random_uuid(),
  ts         timestamptz not null default now(),
  provider   text not null,
  prompt_id  uuid not null references help_geo_prompts (id) on delete cascade,
  language   content_language not null,
  /** Kept so a surprising verdict can be checked rather than argued about. */
  answer_text     text,
  cited_domains   text[] not null default '{}',
  flovoo_cited    boolean not null default false,
  flovoo_urls     text[] not null default '{}',
  /** Where Flovoo appeared among the citations. Null when not cited. */
  position        int,
  competitor_domains text[] not null default '{}',
  error           text
);

create index help_geo_runs_ts_idx     on help_geo_runs (ts desc);
create index help_geo_runs_prompt_idx on help_geo_runs (prompt_id, ts desc);

alter table help_geo_runs enable row level security;
create policy help_geo_runs_admin_all on help_geo_runs
  for all using (help_analytics_allowed()) with check (help_analytics_allowed());

/* A manual spot-check, logged by hand from the audit helper. */
create table help_geo_manual_checks (
  id        uuid primary key default gen_random_uuid(),
  ts        timestamptz not null default now(),
  prompt_id uuid not null references help_geo_prompts (id) on delete cascade,
  provider  text not null,
  verdict   text not null,
  note      text,

  constraint help_manual_verdict check (verdict in ('cited', 'not_cited', 'cited_wrong_page'))
);

alter table help_geo_manual_checks enable row level security;
create policy help_geo_manual_admin_all on help_geo_manual_checks
  for all using (help_analytics_allowed()) with check (help_analytics_allowed());

/* Share of answers citing Flovoo, per provider per language. */
create or replace function help_geo_share(days int default 90)
returns table (
  provider  text,
  language  content_language,
  runs      bigint,
  cited     bigint,
  share     numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select r.provider,
         r.language,
         count(*)                                     as runs,
         count(*) filter (where r.flovoo_cited)       as cited,
         round(
           100.0 * count(*) filter (where r.flovoo_cited) / nullif(count(*), 0),
           1
         )                                            as share
    from help_geo_runs r
   where help_analytics_allowed()
     and r.error is null
     and r.ts >= now() - make_interval(days => days)
   group by r.provider, r.language
   order by r.provider, r.language;
$$;

/* Who is being cited instead of us. This is the content roadmap. */
create or replace function help_geo_competitors(days int default 90, limit_to int default 20)
returns table (domain text, mentions bigint)
language sql
stable
security definer
set search_path = public
as $$
  select d.domain, count(*) as mentions
    from help_geo_runs r
    cross join lateral unnest(r.competitor_domains) as d(domain)
   where help_analytics_allowed()
     and r.ts >= now() - make_interval(days => days)
   group by d.domain
   order by count(*) desc
   limit limit_to;
$$;

revoke all on function help_geo_share(int) from public;
revoke all on function help_geo_competitors(int, int) from public;
grant execute on function help_geo_share(int) to authenticated, service_role;
grant execute on function help_geo_competitors(int, int) to authenticated, service_role;
