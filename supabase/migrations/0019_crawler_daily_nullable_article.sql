-- The daily rollup has to count hits that are not on an article.
--
-- 0018 made `article_id` part of the primary key, which forbids null — but a
-- crawler fetching the help home, a topic, or llms.txt has no article, and
-- those hits are exactly how you tell whether a bot is active at all. Every
-- such hit was being rejected, and with it the whole log entry.
--
-- The key becomes an expression index so "no article" is a real value.

drop table if exists help_ai_crawler_daily;

create table help_ai_crawler_daily (
  day           date not null,
  bot_token     text not null,
  -- Null means the hit was not on an article: the home page, a topic, llms.txt.
  article_id    uuid references help_articles (id) on delete cascade,
  hits          int not null default 0,
  verified_hits int not null default 0
);

/* `coalesce` gives "no article" a stable identity the unique index can hold. */
create unique index help_crawler_daily_key
  on help_ai_crawler_daily
     (day, bot_token, coalesce(article_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index help_crawler_daily_day_idx on help_ai_crawler_daily (day desc);

alter table help_ai_crawler_daily enable row level security;
create policy help_crawler_daily_admin_all on help_ai_crawler_daily
  for all using (help_analytics_allowed()) with check (help_analytics_allowed());

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
  on conflict (day, bot_token, coalesce(article_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update
    set hits = help_ai_crawler_daily.hits + 1,
        verified_hits = help_ai_crawler_daily.verified_hits + case when p_verified then 1 else 0 end;
end;
$$;
