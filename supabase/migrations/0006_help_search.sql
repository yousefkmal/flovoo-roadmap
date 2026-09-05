-- Help center search: Arabic normalization, trigram matching, the chunk table
-- for semantic search, and the two ranking functions the app calls.
--
-- Default full-text search treats hamza variants, ta marbuta and the definite
-- article as different words. Everything indexed and every query goes through
-- `help_normalize()` first — the same pipeline as `normalizeForSearch()` in
-- src/lib/help/arabic.ts. Change one, change the other.

create extension if not exists pg_trgm;
create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Normalization
-- ---------------------------------------------------------------------------

create or replace function help_normalize(input text)
returns text
language sql
immutable
parallel safe
as $$
  select trim(regexp_replace(
    -- 6. strip a fused definite article (ال، وال، بال، فال، كال، لل) when at
    --    least three letters of the word remain
    regexp_replace(
      -- 5. punctuation → space
      regexp_replace(
        -- 4. Arabic-Indic digits → 0-9
        translate(
          -- 3. letter variants: أإآٱ → ا, ى → ي, ة → ه, ؤ → و, ئ → ي
          translate(
            -- 2. drop tashkeel, Quranic marks and tatweel
            regexp_replace(
              -- 1. case-fold Latin
              lower(coalesce(input, '')),
              '[ؐ-ًؚ-ٰٟۖ-ۭـ]', '', 'g'
            ),
            'أإآٱىةؤئ', 'اااايهوي'
          ),
          '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'
        ),
        '[^[:alnum:][:space:]]+', ' ', 'g'
      ),
      '(^|\s)(وال|بال|فال|كال|ال|لل)(?=\S{3,})', '\1', 'g'
    ),
    '\s+', ' ', 'g'
  ));
$$;

-- ---------------------------------------------------------------------------
-- Lexical index
-- ---------------------------------------------------------------------------
-- The searchable text is a generated column so it can never drift from the
-- title, excerpt and body it is built from.

alter table help_article_translations
  add column search_text text
    generated always as (
      help_normalize(title || ' ' || coalesce(excerpt, '') || ' ' || body_plain)
    ) stored;

create index help_translations_search_trgm_idx
  on help_article_translations using gin (search_text gin_trgm_ops);

create index help_translations_title_trgm_idx
  on help_article_translations using gin (help_normalize(title) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- help_article_chunks — semantic search and the AI Agent's retrieval corpus
-- ---------------------------------------------------------------------------
-- Filled by the embedding pipeline on publish (Phase 5). `model` is recorded
-- per row so a model change is a targeted re-embed, not guesswork.

create table help_article_chunks (
  id          uuid primary key default gen_random_uuid(),
  article_id  uuid not null references help_articles (id) on delete cascade,
  language    content_language not null,
  chunk_index int  not null,
  content     text not null,
  embedding   vector(1536),
  model       text not null,
  updated_at  timestamptz not null default now(),

  unique (article_id, language, chunk_index)
);

create index help_chunks_article_idx on help_article_chunks (article_id, language);
-- HNSW: good recall at this corpus size without tuning lists.
create index help_chunks_embedding_idx
  on help_article_chunks using hnsw (embedding vector_cosine_ops);

alter table help_article_chunks enable row level security;

create policy help_chunks_public_read on help_article_chunks
  for select using (help_article_is_public(article_id));
create policy help_chunks_admin_all on help_article_chunks
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- help_search — hybrid ranking
-- ---------------------------------------------------------------------------
-- Lexical: trigram similarity on the normalized title (boosted) and the full
-- search text, plus word similarity so a two-word query finds a long title.
-- Semantic: when the caller supplies a query embedding, the best cosine match
-- among an article's chunks is added. Runs as the caller, so RLS keeps drafts
-- out of the results for the anon role.

create or replace function help_search(
  q               text,
  lang            content_language,
  query_embedding vector(1536) default null,
  max_results     int default 10
)
returns table (
  article_id    uuid,
  slug          text,
  title         text,
  excerpt       text,
  body_plain    text,
  collection_id uuid,
  score         real
)
language sql
stable
as $$
  with nq as (
    select help_normalize(q) as text
  ),
  lexical as (
    select
      t.article_id,
      t.slug,
      t.title,
      t.excerpt,
      t.body_plain,
      a.collection_id,
      (
        3.0 * similarity(help_normalize(t.title), nq.text)
      + 2.0 * word_similarity(nq.text, help_normalize(t.title))
      + 1.0 * similarity(t.search_text, nq.text)
      + 1.5 * word_similarity(nq.text, t.search_text)
      )::real as score
    from help_article_translations t
    join help_articles a on a.id = t.article_id
    cross join nq
    where t.language = lang
      and a.status = 'published'
      and (
        help_normalize(t.title) % nq.text
        or word_similarity(nq.text, help_normalize(t.title)) > 0.4
        or t.search_text % nq.text
        or word_similarity(nq.text, t.search_text) > 0.35
      )
  ),
  semantic as (
    select
      c.article_id,
      max(1 - (c.embedding <=> query_embedding))::real as sim
    from help_article_chunks c
    where query_embedding is not null
      and c.language = lang
      and c.embedding is not null
    group by c.article_id
    having max(1 - (c.embedding <=> query_embedding)) > 0.55
  ),
  candidates as (
    select article_id from lexical
    union
    select article_id from semantic
  )
  select
    t.article_id,
    t.slug,
    t.title,
    t.excerpt,
    t.body_plain,
    a.collection_id,
    (coalesce(l.score, 0) + 2.5 * coalesce(s.sim, 0))::real as score
  from candidates c
  join help_article_translations t on t.article_id = c.article_id and t.language = lang
  join help_articles a on a.id = t.article_id and a.status = 'published'
  left join lexical l on l.article_id = c.article_id
  left join semantic s on s.article_id = c.article_id
  order by score desc, t.title
  limit max_results;
$$;

-- ---------------------------------------------------------------------------
-- help_related — "read next" at the end of an article
-- ---------------------------------------------------------------------------
-- Same topic first, then lexical closeness across the whole corpus. Embedding
-- similarity joins once chunks exist; the shape of the result does not change.

create or replace function help_related(
  source_article uuid,
  lang           content_language,
  max_results    int default 3
)
returns table (
  article_id    uuid,
  slug          text,
  title         text,
  excerpt       text,
  collection_id uuid,
  score         real
)
language sql
stable
as $$
  with source as (
    select t.search_text, help_normalize(t.title) as title_n, a.collection_id
    from help_article_translations t
    join help_articles a on a.id = t.article_id
    where t.article_id = source_article and t.language = lang
  )
  select
    t.article_id,
    t.slug,
    t.title,
    t.excerpt,
    a.collection_id,
    (
      similarity(t.search_text, s.search_text)
    + 0.5 * similarity(help_normalize(t.title), s.title_n)
    + case when a.collection_id = s.collection_id then 0.6 else 0 end
    )::real as score
  from help_article_translations t
  join help_articles a on a.id = t.article_id
  cross join source s
  where t.language = lang
    and a.status = 'published'
    and t.article_id <> source_article
  order by score desc, t.title
  limit max_results;
$$;
