-- A manual position for features, used to break ties.
--
-- The board ranks by votes, which is the whole point of it. But a batch of
-- features imported together all start at zero votes, and then only
-- `created_at` separates them — so a list written in a deliberate order came
-- out reversed, and 19 items sharing one shipped date came out arbitrary.
--
-- `sort_order` sits *after* pinning and votes and *before* the timestamp: it
-- decides the order of things the board considers equal, and a feature that
-- earns votes still rises past it.

alter table features
  add column sort_order int not null default 0;

comment on column features.sort_order is
  'Manual position among features with the same pin state and vote count. Lower first.';

-- 0001 created this index for the old ordering. Same name, same job, one more
-- column — replacing it beats leaving a stale index beside a new one.
drop index if exists features_board_order_idx;
create index features_board_order_idx
  on features (status, is_pinned desc, vote_count desc, sort_order asc, created_at desc);

-- The shipped page orders by date, and a whole batch can share one date.
create index features_shipped_order_idx
  on features (shipped_at desc, sort_order asc) where status = 'shipped';

-- `public_board()` ranks the same way, so it has to learn the same tiebreak.
create or replace function public_board()
returns setof features
language sql
stable
as $$
  select *
    from features
   where status in ('under_review', 'planned', 'in_progress', 'shipped')
   order by is_pinned desc, vote_count desc, sort_order asc, created_at desc;
$$;
