-- Changelog: entry kinds, cover images, and reactions.
--
-- The Updates tab is modelled on the reference portal: each entry carries a
-- kind ("New" / "Improved" / "Fixed") alongside the category it belongs to, and
-- readers can react with an emoji.

create type changelog_kind as enum ('new', 'improved', 'fixed');

alter table changelog_entries
  add column kind changelog_kind not null default 'new',
  -- Alt text is not optional: a cover image that says something needs to say it
  -- to everyone.
  add column image_alt_ar text,
  add column image_alt_en text;

-- ---------------------------------------------------------------------------
-- changelog_reactions
-- ---------------------------------------------------------------------------
-- One row per person per emoji per entry: someone may react with more than one
-- emoji, but not twice with the same.

create table changelog_reactions (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references changelog_entries (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),

  unique (entry_id, user_id, emoji),
  -- Keeps the set closed. An open text column here is an invitation to store
  -- anything, and the UI only ever offers these.
  constraint changelog_reactions_allowed
    check (emoji in ('🎉', '🔥', '💯', '👏', '❤️'))
);

create index changelog_reactions_entry_idx on changelog_reactions (entry_id);

alter table changelog_reactions enable row level security;

-- Counts are public; who reacted is not something the anon role needs, but the
-- tally has to be readable to render it.
create policy changelog_reactions_public_read on changelog_reactions
  for select using (true);
create policy changelog_reactions_self_write on changelog_reactions
  for insert with check (auth.uid() = user_id);
create policy changelog_reactions_self_delete on changelog_reactions
  for delete using (auth.uid() = user_id);
