-- Lets the analytics aggregates answer the server, and makes their guard uniform.
--
-- Two problems with the guard as 0009 shipped it:
--
-- 1. `is_admin()` resolves the caller through `auth.uid()`, which is null for
--    the service-role key — the key the dashboard reads with. Every card would
--    have rendered zero. It is also null for a bootstrap admin who is listed in
--    `ADMIN_EMAILS` but not yet in `admin_users`, which is the normal state for
--    the first admin.
-- 2. `help_stats_overview` returned a row of zeros to a caller with no session
--    while every other function returned no rows. Harmless — the values were
--    all zero — but an inconsistent guard is one somebody later misreads.
--
-- Both are fixed here rather than by editing 0009, which is applied.

/**
 * Who may read help-center analytics: an admin in the roster, or the server
 * itself. The service role is only reachable from server code that has already
 * resolved an admin session (`requireAdmin()`); the anon key never satisfies
 * this, so calling an aggregate directly from a browser still returns nothing.
 */
create or replace function help_analytics_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_admin() or coalesce(auth.role(), '') = 'service_role';
$$;

-- ---------------------------------------------------------------------------
-- Re-create every aggregate against the new guard
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
    (select count(*) from help_article_views where viewed_at > now() - make_interval(days => days)),
    (select count(*) from help_article_views where viewed_at > now() - make_interval(days => days) and language = 'ar'),
    (select count(*) from help_article_views where viewed_at > now() - make_interval(days => days) and language = 'en'),
    -- The window before this one, so the card can show a direction of travel.
    (select count(*) from help_article_views
      where viewed_at > now() - make_interval(days => days * 2)
        and viewed_at <= now() - make_interval(days => days)),
    (select count(*) from help_search_queries where created_at > now() - make_interval(days => days)),
    (select count(*) from help_search_queries where created_at > now() - make_interval(days => days) and results_count = 0),
    (select count(*) from help_search_queries where created_at > now() - make_interval(days => days) and clicked_article_id is not null),
    (select count(*) from help_article_feedback where created_at > now() - make_interval(days => days)),
    (select count(*) from help_article_feedback where created_at > now() - make_interval(days => days) and is_helpful)
  -- No session, no row: the same answer every other aggregate gives.
  where help_analytics_allowed();
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
   where help_analytics_allowed()
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
  select v.article_id, v.language, count(*)
    from help_article_views v
   where help_analytics_allowed()
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
      count(*),
      count(*) filter (where q.results_count = 0),
      count(*) filter (where q.clicked_article_id is not null),
      max(q.created_at)
    from help_search_queries q
   where help_analytics_allowed()
     and q.created_at > now() - make_interval(days => days)
   group by 1, 2
   order by count(*) desc, max(q.created_at) desc
   limit max_results;
$$;

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
  select q.query, q.language, count(*), max(q.created_at)
    from help_search_queries q
   where help_analytics_allowed()
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
   where help_analytics_allowed()
     and not f.is_helpful
     and f.created_at > now() - make_interval(days => days)
     and not exists (
       select 1 from help_gap_dismissals d
        where d.kind = 'feedback' and d.ref = f.id::text
     )
   order by f.created_at desc
   limit max_results;
$$;

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
   where help_analytics_allowed()
     and coalesce(f.helpful, 0) + coalesce(f.unhelpful, 0) > 0
   order by coalesce(f.unhelpful, 0) desc, coalesce(v.views, 0) desc
   limit max_results;
$$;
