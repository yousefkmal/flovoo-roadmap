-- Help center analytics: the aggregates the admin dashboard reads, the
-- content-gap inbox's dismissal list, and the read contract the AI Agent uses.
--
-- Every aggregate is a security-definer function that checks `is_admin()`
-- itself: the underlying event tables are admin-read-only, and one function
-- per card keeps the dashboard to a handful of round trips instead of pulling
-- raw rows into the app to count them there.

-- ---------------------------------------------------------------------------
-- help_gap_dismissals — "not a content gap", per item
-- ---------------------------------------------------------------------------
-- A zero-result query is keyed by its own text (the same question asked twice
-- is one gap); a piece of negative feedback is keyed by its row id.

create table help_gap_dismissals (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('query', 'feedback')),
  ref          text not null,
  dismissed_at timestamptz not null default now(),

  unique (kind, ref)
);

alter table help_gap_dismissals enable row level security;

create policy help_gap_dismissals_admin_all on help_gap_dismissals
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Aggregates
-- ---------------------------------------------------------------------------

create or replace function help_stats_overview(days int default 30)
returns table (
  views_total       bigint,
  views_ar          bigint,
  views_en          bigint,
  views_previous    bigint,
  searches_total    bigint,
  searches_zero     bigint,
  searches_clicked  bigint,
  feedback_total    bigint,
  feedback_helpful  bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from help_article_views where is_admin() and viewed_at > now() - make_interval(days => days)),
    (select count(*) from help_article_views where is_admin() and viewed_at > now() - make_interval(days => days) and language = 'ar'),
    (select count(*) from help_article_views where is_admin() and viewed_at > now() - make_interval(days => days) and language = 'en'),
    -- The window before this one, so the card can show a direction of travel.
    (select count(*) from help_article_views where is_admin()
       and viewed_at > now() - make_interval(days => days * 2)
       and viewed_at <= now() - make_interval(days => days)),
    (select count(*) from help_search_queries where is_admin() and created_at > now() - make_interval(days => days)),
    (select count(*) from help_search_queries where is_admin() and created_at > now() - make_interval(days => days) and results_count = 0),
    (select count(*) from help_search_queries where is_admin() and created_at > now() - make_interval(days => days) and clicked_article_id is not null),
    (select count(*) from help_article_feedback where is_admin() and created_at > now() - make_interval(days => days)),
    (select count(*) from help_article_feedback where is_admin() and created_at > now() - make_interval(days => days) and is_helpful);
$$;

create or replace function help_views_daily(days int default 30)
returns table (day date, language content_language, views bigint)
language sql
stable
security definer
set search_path = public
as $$
  select date_trunc('day', v.viewed_at)::date, v.language, count(*)
    from help_article_views v
   where is_admin()
     and v.viewed_at > now() - make_interval(days => days)
   group by 1, 2
   order by 1;
$$;

create or replace function help_top_articles(days int default 30, max_results int default 10)
returns table (article_id uuid, language content_language, views bigint)
language sql
stable
security definer
set search_path = public
as $$
  select v.article_id, v.language, count(*) as views
    from help_article_views v
   where is_admin()
     and v.viewed_at > now() - make_interval(days => days)
   group by 1, 2
   order by count(*) desc
   limit max_results;
$$;

create or replace function help_top_queries(days int default 30, max_results int default 10)
returns table (
  query        text,
  language     content_language,
  searches     bigint,
  zero_results bigint,
  clicks       bigint,
  last_seen    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
      q.query,
      q.language,
      count(*) as searches,
      count(*) filter (where q.results_count = 0) as zero_results,
      count(*) filter (where q.clicked_article_id is not null) as clicks,
      max(q.created_at) as last_seen
    from help_search_queries q
   where is_admin()
     and q.created_at > now() - make_interval(days => days)
   group by 1, 2
   order by count(*) desc, max(q.created_at) desc
   limit max_results;
$$;

-- The content-gap inbox's first half: questions that returned nothing and have
-- not been dismissed. Grouped by the query text, so asking twice is one gap.
create or replace function help_content_gaps(days int default 90, max_results int default 30)
returns table (
  query     text,
  language  content_language,
  searches  bigint,
  last_seen timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
      q.query,
      q.language,
      count(*) as searches,
      max(q.created_at) as last_seen
    from help_search_queries q
   where is_admin()
     and q.results_count = 0
     and q.created_at > now() - make_interval(days => days)
     and not exists (
       select 1 from help_gap_dismissals d
        where d.kind = 'query' and d.ref = q.query
     )
   group by 1, 2
   order by count(*) desc, max(q.created_at) desc
   limit max_results;
$$;

-- The other half: "this did not help", newest first, undismissed.
create or replace function help_negative_feedback(days int default 90, max_results int default 30)
returns table (
  id         uuid,
  article_id uuid,
  language   content_language,
  comment    text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.article_id, f.language, f.comment, f.created_at
    from help_article_feedback f
   where is_admin()
     and not f.is_helpful
     and f.created_at > now() - make_interval(days => days)
     and not exists (
       select 1 from help_gap_dismissals d
        where d.kind = 'feedback' and d.ref = f.id::text
     )
   order by f.created_at desc
   limit max_results;
$$;

-- Helpfulness per article, with views alongside: a low score on a page nobody
-- reads is noise, the same score on a popular page is the next thing to fix.
create or replace function help_article_helpfulness(days int default 90, max_results int default 20)
returns table (
  article_id uuid,
  language   content_language,
  helpful    bigint,
  unhelpful  bigint,
  views      bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with f as (
    select article_id, language,
           count(*) filter (where is_helpful) as helpful,
           count(*) filter (where not is_helpful) as unhelpful
      from help_article_feedback
     where created_at > now() - make_interval(days => days)
     group by 1, 2
  ),
  v as (
    select article_id, language, count(*) as views
      from help_article_views
     where viewed_at > now() - make_interval(days => days)
     group by 1, 2
  )
  select
      coalesce(f.article_id, v.article_id),
      coalesce(f.language, v.language),
      coalesce(f.helpful, 0),
      coalesce(f.unhelpful, 0),
      coalesce(v.views, 0)
    from f
    full outer join v on v.article_id = f.article_id and v.language = f.language
   where is_admin()
     and coalesce(f.helpful, 0) + coalesce(f.unhelpful, 0) > 0
   order by coalesce(f.unhelpful, 0) desc, coalesce(v.views, 0) desc
   limit max_results;
$$;

-- ---------------------------------------------------------------------------
-- The AI Agent's read contract — v1
-- ---------------------------------------------------------------------------
-- `security_invoker` so the existing RLS decides what is visible: the anon key
-- sees published articles and their chunks, nothing else. The REST endpoint in
-- `/api/agent/v1/*` is the documented contract; this view is the same data for
-- anything talking to Postgres directly.

create or replace view help_agent_articles
with (security_invoker = true) as
  select
      a.id            as article_id,
      t.language,
      t.slug,
      t.title,
      t.excerpt,
      t.body_plain,
      c.slug          as collection_slug,
      case when t.language = 'ar' then c.name_ar else c.name_en end as collection_name,
      a.published_at,
      greatest(a.updated_at, t.updated_at) as updated_at
    from help_articles a
    join help_article_translations t on t.article_id = a.id
    join help_collections c on c.id = a.collection_id
   where a.status = 'published'
     and c.is_published;

create or replace view help_agent_chunks
with (security_invoker = true) as
  select
      k.article_id,
      k.language,
      k.chunk_index,
      k.content,
      k.model,
      k.updated_at,
      t.slug,
      t.title
    from help_article_chunks k
    join help_article_translations t
      on t.article_id = k.article_id and t.language = k.language
    join help_articles a on a.id = k.article_id
   where a.status = 'published';

-- Retrieval for the agent: nearest chunks to a query embedding, with enough
-- context to cite the article. Stable contract — additive changes only.
create or replace function help_agent_retrieve(
  query_embedding vector(1536),
  lang            content_language default null,
  max_results     int default 6,
  min_similarity  real default 0.5
)
returns table (
  article_id  uuid,
  language    content_language,
  slug        text,
  title       text,
  chunk_index int,
  content     text,
  similarity  real
)
language sql
stable
as $$
  select
      k.article_id,
      k.language,
      k.slug,
      k.title,
      k.chunk_index,
      k.content,
      (1 - (c.embedding <=> query_embedding))::real as similarity
    from help_agent_chunks k
    join help_article_chunks c
      on c.article_id = k.article_id
     and c.language = k.language
     and c.chunk_index = k.chunk_index
   where c.embedding is not null
     and (lang is null or k.language = lang)
     and (1 - (c.embedding <=> query_embedding)) >= min_similarity
   order by similarity desc
   limit max_results;
$$;
