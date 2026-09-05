-- Help center redirects and 404 bookkeeping.
--
-- `help_redirects` exists since 0005. This adds the two functions the public
-- pages call: one follows a redirect and counts the hit in a single statement,
-- the other records an unknown path so the analytics phase can list the paths
-- people still arrive at. Both are security definer so the anon role can call
-- them without any read or write policy on the tables themselves.

create table help_not_found (
  path       text primary key,
  hits       int  not null default 1,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),

  constraint help_not_found_path check (path like '/%' and length(path) <= 500)
);

alter table help_not_found enable row level security;

create policy help_not_found_admin_all on help_not_found
  for all using (is_admin()) with check (is_admin());

-- Resolves the first matching source path, increments its counter, and returns
-- the target (or null). Callers pass the candidate spellings of one request —
-- with and without the locale prefix — in order of preference.
create or replace function help_redirect_hit(candidates text[])
returns table (target_path text, status_code int)
language plpgsql
security definer
set search_path = public
as $$
declare
  hit help_redirects;
begin
  select r.* into hit
    from help_redirects r
    join unnest(candidates) with ordinality c(path, ord) on c.path = r.source_path
   order by c.ord
   limit 1;

  if hit.id is null then
    return;
  end if;

  update help_redirects set hits = hits + 1 where id = hit.id;
  return query select hit.target_path, hit.status_code;
end;
$$;

create or replace function help_note_not_found(missing_path text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into help_not_found (path)
  values (left(missing_path, 500))
  on conflict (path) do update
    set hits = help_not_found.hits + 1,
        last_seen = now();
$$;

revoke all on function help_redirect_hit(text[]) from public;
revoke all on function help_note_not_found(text) from public;
grant execute on function help_redirect_hit(text[]) to anon, authenticated, service_role;
grant execute on function help_note_not_found(text) to anon, authenticated, service_role;
