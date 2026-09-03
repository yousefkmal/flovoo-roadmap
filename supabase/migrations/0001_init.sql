-- Flovoo Public Roadmap & Feedback Portal — initial schema
-- Postgres / Supabase. Run with: supabase db push  (or paste into the SQL editor)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type feature_status as enum (
  'under_review',
  'planned',
  'in_progress',
  'shipped',
  'archived'
);

create type feature_source as enum ('internal', 'customer_submission');

create type submission_status as enum ('pending', 'approved', 'merged', 'rejected');

create type content_language as enum ('ar', 'en');

-- ---------------------------------------------------------------------------
-- Admin identity
-- ---------------------------------------------------------------------------

create table admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

-- security definer so RLS policies can call it without recursing into the table
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

create table categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name_ar    text not null,
  name_en    text not null,
  color      text not null default '#4C85FF',
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create index categories_sort_order_idx on categories (sort_order);

-- ---------------------------------------------------------------------------
-- features
-- ---------------------------------------------------------------------------

create table features (
  id             uuid primary key default gen_random_uuid(),
  title_ar       text not null,
  title_en       text not null,
  description_ar text,
  description_en text,
  status         feature_status not null default 'under_review',
  category_id    uuid references categories (id) on delete set null,
  vote_count     int not null default 0,
  is_pinned      boolean not null default false,
  source         feature_source not null default 'internal',
  -- kept denormalised: customer submitters are not auth users
  submitted_by_name  text,
  submitted_by_email text,
  submitted_by_user  uuid references auth.users (id) on delete set null,
  shipped_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint features_shipped_at_required
    check (status <> 'shipped' or shipped_at is not null)
);

create index features_status_idx      on features (status);
create index features_category_idx    on features (category_id);
create index features_board_order_idx on features (status, is_pinned desc, vote_count desc, created_at desc);

create trigger features_set_updated_at
  before update on features
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- votes
-- ---------------------------------------------------------------------------
-- voter_identity: sha256 of the lowercased email (or the Flovoo user id once the
-- portal is embedded in the app). Never store the raw email here.

create table votes (
  id             uuid primary key default gen_random_uuid(),
  feature_id     uuid not null references features (id) on delete cascade,
  voter_identity text not null,
  created_at     timestamptz not null default now(),

  unique (feature_id, voter_identity)
);

create index votes_feature_idx  on votes (feature_id);
create index votes_identity_idx on votes (voter_identity);

create or replace function sync_feature_vote_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update features set vote_count = vote_count + 1 where id = new.feature_id;
    return new;
  elsif tg_op = 'DELETE' then
    update features set vote_count = greatest(vote_count - 1, 0) where id = old.feature_id;
    return old;
  elsif tg_op = 'UPDATE' and new.feature_id <> old.feature_id then
    update features set vote_count = greatest(vote_count - 1, 0) where id = old.feature_id;
    update features set vote_count = vote_count + 1 where id = new.feature_id;
    return new;
  end if;
  return new;
end;
$$;

create trigger votes_sync_count
  after insert or update or delete on votes
  for each row execute function sync_feature_vote_count();

-- ---------------------------------------------------------------------------
-- submissions (raw customer ideas, pre-moderation)
-- ---------------------------------------------------------------------------

create table submissions (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  category_id    uuid references categories (id) on delete set null,
  submitter_name  text not null,
  submitter_email text not null,
  language       content_language not null default 'ar',
  status         submission_status not null default 'pending',
  merged_into    uuid references features (id) on delete set null,
  created_feature uuid references features (id) on delete set null,
  internal_note  text,
  -- anti-spam bookkeeping; not exposed publicly
  ip_hash        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index submissions_status_idx on submissions (status, created_at desc);
create index submissions_email_idx  on submissions (lower(submitter_email), created_at desc);

create trigger submissions_set_updated_at
  before update on submissions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- changelog_entries
-- ---------------------------------------------------------------------------

create table changelog_entries (
  id           uuid primary key default gen_random_uuid(),
  feature_id   uuid references features (id) on delete set null,
  title_ar     text not null,
  title_en     text not null,
  body_ar      text,
  body_en      text,
  image_url    text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint changelog_published_at_required
    check (not is_published or published_at is not null)
);

create index changelog_published_idx on changelog_entries (is_published, published_at desc);

create trigger changelog_set_updated_at
  before update on changelog_entries
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- comments (Phase 2 — table created now so the model is complete)
-- ---------------------------------------------------------------------------

create table comments (
  id              uuid primary key default gen_random_uuid(),
  feature_id      uuid not null references features (id) on delete cascade,
  author_identity text not null,
  author_name     text not null,
  body            text not null,
  is_hidden       boolean not null default false,
  created_at      timestamptz not null default now()
);

create index comments_feature_idx on comments (feature_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Public board payload: the four live stages, never archived items.
create or replace function public_board()
returns setof features
language sql
stable
as $$
  select * from features
  where status in ('under_review', 'planned', 'in_progress', 'shipped')
  order by is_pinned desc, vote_count desc, created_at desc;
$$;

-- Admin-only: fold `source_id` into `target_id`, transferring votes that the
-- target does not already have, then archive the duplicate.
create or replace function merge_features(source_id uuid, target_id uuid)
returns features
language plpgsql
security definer
set search_path = public
as $$
declare
  merged features;
begin
  if not is_admin() then
    raise exception 'merge_features: admin only';
  end if;
  if source_id = target_id then
    raise exception 'merge_features: source and target must differ';
  end if;

  update votes v
     set feature_id = target_id
   where v.feature_id = source_id
     and not exists (
       select 1 from votes t
        where t.feature_id = target_id
          and t.voter_identity = v.voter_identity
     );

  delete from votes where feature_id = source_id;

  update submissions
     set merged_into = target_id
   where merged_into = source_id;

  update features
     set status = 'archived'
   where id = source_id;

  select * into merged from features where id = target_id;
  return merged;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table categories        enable row level security;
alter table features          enable row level security;
alter table votes             enable row level security;
alter table submissions       enable row level security;
alter table changelog_entries enable row level security;
alter table comments          enable row level security;
alter table admin_users       enable row level security;

-- categories: world-readable, admin-writable
create policy categories_public_read on categories
  for select using (true);
create policy categories_admin_write on categories
  for all using (is_admin()) with check (is_admin());

-- features: public sees the live board + shipped items; archived is admin-only
create policy features_public_read on features
  for select using (status <> 'archived');
create policy features_admin_read on features
  for select using (is_admin());
create policy features_admin_write on features
  for all using (is_admin()) with check (is_admin());

-- votes: anyone may cast one; nobody but admins may read the identities back
create policy votes_public_insert on votes
  for insert with check (true);
create policy votes_admin_read on votes
  for select using (is_admin());
create policy votes_admin_write on votes
  for all using (is_admin()) with check (is_admin());

-- submissions: write-only for the public (moderation queue stays private)
create policy submissions_public_insert on submissions
  for insert with check (status = 'pending' and merged_into is null);
create policy submissions_admin_read on submissions
  for select using (is_admin());
create policy submissions_admin_write on submissions
  for all using (is_admin()) with check (is_admin());

-- changelog: only published entries are public
create policy changelog_public_read on changelog_entries
  for select using (is_published);
create policy changelog_admin_all on changelog_entries
  for all using (is_admin()) with check (is_admin());

-- comments: hidden comments are admin-only
create policy comments_public_read on comments
  for select using (not is_hidden);
create policy comments_public_insert on comments
  for insert with check (not is_hidden);
create policy comments_admin_all on comments
  for all using (is_admin()) with check (is_admin());

-- admin_users: an admin can see the roster, nobody else
create policy admin_users_admin_read on admin_users
  for select using (is_admin());
