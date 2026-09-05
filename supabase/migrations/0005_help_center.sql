-- Help center: collections, articles, per-language translations, media, and the
-- event tables that feed search analytics, helpfulness and redirects.
--
-- Everything is prefixed `help_` because the roadmap already owns `categories`,
-- and `media` / `redirects` are too generic to share a namespace with. The
-- roadmap's `content_language` enum, `is_admin()` and `set_updated_at()` are
-- reused rather than duplicated.
--
-- Not here on purpose: `help_article_chunks` and the pgvector / pg_trgm
-- extensions. The vector dimension depends on the embedding model, which is an
-- open decision; both arrive with the search and RAG phases.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type help_article_status as enum ('draft', 'published', 'archived');

-- ---------------------------------------------------------------------------
-- help_collections — the small set of categories on the home page
-- ---------------------------------------------------------------------------

create table help_collections (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name_ar        text not null,
  name_en        text not null,
  description_ar text,
  description_en text,
  -- A Lucide icon name (kebab-case). The app maps it through an allow-list.
  icon           text not null default 'book-open',
  sort_order     int  not null default 0,
  is_published   boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint help_collections_slug_shape check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index help_collections_order_idx on help_collections (is_published, sort_order);

create trigger help_collections_set_updated_at
  before update on help_collections
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- help_articles — language-neutral: status, placement, dates
-- ---------------------------------------------------------------------------

create table help_articles (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references help_collections (id) on delete restrict,
  status        help_article_status not null default 'draft',
  -- "Most read" on the home page is editorial, not measured.
  is_pinned     boolean not null default false,
  sort_order    int not null default 0,
  -- Optional grouping inside the topic; the category page renders one card
  -- per section. Both languages or neither.
  section_ar    text,
  section_en    text,
  -- A Lucide icon name for the article's row in navigation; the app maps it
  -- through an allow-list and falls back to a document glyph.
  icon          text not null default 'file-text',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz,

  constraint help_articles_published_at_required
    check (status <> 'published' or published_at is not null),
  constraint help_articles_section_both_languages
    check ((section_ar is null) = (section_en is null))
);

create index help_articles_collection_idx on help_articles (collection_id, status, sort_order);
create index help_articles_status_idx     on help_articles (status, is_pinned desc, updated_at desc);

create trigger help_articles_set_updated_at
  before update on help_articles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- help_article_translations — one row per article per language
-- ---------------------------------------------------------------------------
-- `body` is Tiptap-compatible ProseMirror JSON. `body_plain`, `toc` and
-- `reading_minutes` are derived from it by the application on every save
-- (`deriveArticleMeta` in src/lib/help/blocks.ts) — never edited by hand.
-- Slugs are stored verbatim in their own script and percent-encoded only in
-- the URL, so an Arabic slug is readable here and in the address bar.

create table help_article_translations (
  id               uuid primary key default gen_random_uuid(),
  article_id       uuid not null references help_articles (id) on delete cascade,
  language         content_language not null,
  slug             text not null,
  title            text not null,
  excerpt          text,
  body             jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  body_plain       text  not null default '',
  meta_title       text,
  meta_description text,
  og_image_path    text,
  toc              jsonb not null default '[]'::jsonb,
  reading_minutes  int   not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (article_id, language),
  unique (language, slug),
  -- No path separators, whitespace or query characters; everything else,
  -- including Arabic letters, is allowed.
  constraint help_translations_slug_shape
    check (slug <> '' and slug !~ '[/\\?#%\s]'),
  constraint help_translations_body_is_doc
    check (jsonb_typeof(body) = 'object' and body ->> 'type' = 'doc')
);

create index help_translations_lookup_idx on help_article_translations (language, slug);
create index help_translations_article_idx on help_article_translations (article_id);

create trigger help_translations_set_updated_at
  before update on help_article_translations
  for each row execute function set_updated_at();

-- A body edit is a change to the article: keep the parent's `updated_at`
-- moving so "last updated" and, later, the sitemap can read one column.
create or replace function help_touch_article()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update help_articles set updated_at = now() where id = new.article_id;
  return new;
end;
$$;

create trigger help_translations_touch_article
  after insert or update on help_article_translations
  for each row execute function help_touch_article();

-- ---------------------------------------------------------------------------
-- help_media — the media library (uploads land in Supabase Storage)
-- ---------------------------------------------------------------------------

create table help_media (
  id           uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  alt_ar       text,
  alt_en       text,
  width        int,
  height       int,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Event tables — privacy-light, first party, no PII
-- ---------------------------------------------------------------------------

create table help_article_feedback (
  id           uuid primary key default gen_random_uuid(),
  article_id   uuid not null references help_articles (id) on delete cascade,
  language     content_language not null,
  is_helpful   boolean not null,
  comment      text,
  visitor_hash text not null,
  created_at   timestamptz not null default now(),

  constraint help_feedback_comment_length check (comment is null or length(comment) <= 1000)
);

create index help_feedback_article_idx on help_article_feedback (article_id, created_at desc);
create index help_feedback_negative_idx on help_article_feedback (created_at desc) where not is_helpful;

create table help_article_views (
  id              uuid primary key default gen_random_uuid(),
  article_id      uuid not null references help_articles (id) on delete cascade,
  language        content_language not null,
  viewed_at       timestamptz not null default now(),
  referrer_domain text,
  session_hash    text not null
);

create index help_views_article_idx on help_article_views (article_id, viewed_at desc);
create index help_views_time_idx    on help_article_views (viewed_at desc);

create table help_search_queries (
  id                 uuid primary key default gen_random_uuid(),
  query              text not null,
  language           content_language not null,
  results_count      int not null default 0,
  clicked_article_id uuid references help_articles (id) on delete set null,
  created_at         timestamptz not null default now(),

  constraint help_search_query_length check (length(query) between 1 and 200)
);

create index help_search_time_idx on help_search_queries (created_at desc);
-- The content-gap inbox reads exactly this.
create index help_search_zero_idx on help_search_queries (created_at desc) where results_count = 0;

create table help_redirects (
  id          uuid primary key default gen_random_uuid(),
  source_path text not null unique,
  target_path text not null,
  status_code int  not null default 301,
  hits        int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint help_redirects_status check (status_code in (301, 302, 308)),
  constraint help_redirects_paths check (source_path like '/%' and target_path <> '')
);

create trigger help_redirects_set_updated_at
  before update on help_redirects
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Whether an article is visible to the public: published, in a published
-- collection. Security definer so the translations policy can ask without
-- going through the parent tables' own policies.
create or replace function help_article_is_public(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from help_articles a
      join help_collections c on c.id = a.collection_id
     where a.id = target
       and a.status = 'published'
       and c.is_published
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table help_collections           enable row level security;
alter table help_articles              enable row level security;
alter table help_article_translations  enable row level security;
alter table help_media                 enable row level security;
alter table help_article_feedback      enable row level security;
alter table help_article_views         enable row level security;
alter table help_search_queries        enable row level security;
alter table help_redirects             enable row level security;

-- collections: published ones are public; admins see and edit everything
create policy help_collections_public_read on help_collections
  for select using (is_published);
create policy help_collections_admin_all on help_collections
  for all using (is_admin()) with check (is_admin());

-- articles: drafts and archived rows never leave the admin side
create policy help_articles_public_read on help_articles
  for select using (status = 'published');
create policy help_articles_admin_all on help_articles
  for all using (is_admin()) with check (is_admin());

-- translations: readable only when the parent article is public
create policy help_translations_public_read on help_article_translations
  for select using (help_article_is_public(article_id));
create policy help_translations_admin_all on help_article_translations
  for all using (is_admin()) with check (is_admin());

-- media: paths and alt text are public (the files are, too); admins manage
create policy help_media_public_read on help_media
  for select using (true);
create policy help_media_admin_all on help_media
  for all using (is_admin()) with check (is_admin());

-- feedback / views / search: anyone may write, nobody but admins may read.
-- Rate limiting is enforced by the server action that performs the insert.
create policy help_feedback_public_insert on help_article_feedback
  for insert with check (help_article_is_public(article_id));
create policy help_feedback_admin_all on help_article_feedback
  for all using (is_admin()) with check (is_admin());

create policy help_views_public_insert on help_article_views
  for insert with check (help_article_is_public(article_id));
create policy help_views_admin_all on help_article_views
  for all using (is_admin()) with check (is_admin());

create policy help_search_public_insert on help_search_queries
  for insert with check (true);
create policy help_search_admin_all on help_search_queries
  for all using (is_admin()) with check (is_admin());

-- redirects: served by the server with its own key; not a public table
create policy help_redirects_admin_all on help_redirects
  for all using (is_admin()) with check (is_admin());
