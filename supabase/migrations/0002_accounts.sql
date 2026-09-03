-- Accounts, notification preferences, and per-feature follows.
--
-- This supersedes the lightweight name+email identity from 0001: voting and
-- submitting now require a real account, so a visitor can be told when the
-- thing they asked for ships.

-- ---------------------------------------------------------------------------
-- profiles — the public half of an auth user
-- ---------------------------------------------------------------------------

create type notification_scope as enum (
  'all',       -- every shipped feature
  'following', -- only features this person voted for or followed
  'none'
);

create table profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  display_name  text,
  avatar_url    text,
  locale        content_language not null default 'ar',
  notify_scope  notification_scope not null default 'following',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

/**
 * A profile row per auth user, created the moment they sign up. Google gives us
 * a name and an avatar in the identity payload; email sign-in gives neither, so
 * those stay null until the person fills them in.
 */
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- votes now belong to an account
-- ---------------------------------------------------------------------------

alter table votes
  add column user_id uuid references auth.users (id) on delete cascade;

-- `voter_identity` stays for rows cast before accounts existed. New rows carry
-- a user id, and this is the constraint that enforces one vote per person.
alter table votes alter column voter_identity drop not null;
create unique index votes_feature_user_idx on votes (feature_id, user_id)
  where user_id is not null;

alter table submissions
  add column submitted_by uuid references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- feature_subscriptions — "notify me about this one"
-- ---------------------------------------------------------------------------

create table feature_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  feature_id uuid not null references features (id) on delete cascade,
  created_at timestamptz not null default now(),

  unique (user_id, feature_id)
);

create index feature_subscriptions_feature_idx on feature_subscriptions (feature_id);

-- ---------------------------------------------------------------------------
-- notification_outbox — what to send, decided at write time
-- ---------------------------------------------------------------------------
-- Rows are written when a feature ships and drained by a worker. Keeping the
-- decision here rather than in the sender means "who should have been told" is
-- answerable after the fact, and a delivery failure is retryable without
-- recomputing anything.

create type notification_status as enum ('pending', 'sent', 'failed');

create table notification_outbox (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  feature_id  uuid references features (id) on delete set null,
  kind        text not null default 'feature_shipped',
  locale      content_language not null default 'ar',
  status      notification_status not null default 'pending',
  attempts    int not null default 0,
  last_error  text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,

  -- The same person is never told about the same feature twice.
  unique (user_id, feature_id, kind)
);

create index notification_outbox_pending_idx
  on notification_outbox (status, created_at)
  where status = 'pending';

/**
 * Queues everyone who should hear that a feature shipped: people who follow it,
 * people who voted for it, and people who asked to hear about everything —
 * minus anyone set to `none`. Idempotent, so calling it twice is harmless.
 */
create or replace function enqueue_shipped_notifications(target_feature uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  queued int;
begin
  insert into notification_outbox (user_id, feature_id, kind, locale)
  select p.id, target_feature, 'feature_shipped', p.locale
  from profiles p
  where p.notify_scope <> 'none'
    and (
      p.notify_scope = 'all'
      or exists (select 1 from feature_subscriptions s
                  where s.user_id = p.id and s.feature_id = target_feature)
      or exists (select 1 from votes v
                  where v.user_id = p.id and v.feature_id = target_feature)
    )
  on conflict (user_id, feature_id, kind) do nothing;

  get diagnostics queued = row_count;
  return queued;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table profiles              enable row level security;
alter table feature_subscriptions enable row level security;
alter table notification_outbox   enable row level security;

-- A person can see and edit their own profile, and nobody else's.
create policy profiles_self_read on profiles
  for select using (auth.uid() = id);
create policy profiles_self_update on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_admin_read on profiles
  for select using (is_admin());

-- Follows are private to the person who made them.
create policy subscriptions_self_all on feature_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy subscriptions_admin_read on feature_subscriptions
  for select using (is_admin());

-- The outbox is never client-readable; it is drained with the service key.
create policy outbox_admin_read on notification_outbox
  for select using (is_admin());

-- Votes: a signed-in person may cast and retract their own, and read them back.
drop policy if exists votes_public_insert on votes;
create policy votes_self_insert on votes
  for insert with check (auth.uid() = user_id);
create policy votes_self_read on votes
  for select using (auth.uid() = user_id);
create policy votes_self_delete on votes
  for delete using (auth.uid() = user_id);

-- Submissions now carry their author.
drop policy if exists submissions_public_insert on submissions;
create policy submissions_self_insert on submissions
  for insert with check (
    status = 'pending' and merged_into is null and auth.uid() = submitted_by
  );
