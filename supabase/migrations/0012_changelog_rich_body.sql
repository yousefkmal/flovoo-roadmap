-- Changelog entries get the same rich body the help center already uses.
--
-- `body_ar` / `body_en` were plain text, rendered as paragraphs and nothing
-- else. That was enough for a hand-written release note and not enough for the
-- 116 announcements coming out of Intercom: 98% of them use a bulleted list,
-- bold text, a link or a heading, and flattening all of that into paragraphs
-- would lose the part that makes them readable.
--
-- The new shape is the ProseMirror JSON `help_article_translations.body`
-- already stores, so the editor and the renderer are the ones the help center
-- uses — no second vocabulary, no mapping layer.
--
-- The two entries already written are converted in place: each blank-line-
-- separated paragraph becomes a paragraph node. Nothing is lost.

create or replace function changelog_plain_to_doc(source text)
returns jsonb
language sql
immutable
as $$
  select case
    when source is null then null
    else jsonb_build_object(
      'type', 'doc',
      'content', coalesce(
        (
          select jsonb_agg(
                   jsonb_build_object(
                     'type', 'paragraph',
                     'content', jsonb_build_array(
                       jsonb_build_object('type', 'text', 'text', btrim(paragraph))
                     )
                   )
                 )
            from regexp_split_to_table(source, '\n{2,}') as paragraph
           where btrim(paragraph) <> ''
        ),
        '[]'::jsonb
      )
    )
  end;
$$;

alter table changelog_entries
  alter column body_ar type jsonb using changelog_plain_to_doc(body_ar),
  alter column body_en type jsonb using changelog_plain_to_doc(body_en);

-- The same guard the article bodies carry: whatever is stored has to be a
-- document, so the renderer never has to defend against a bare string.
alter table changelog_entries
  add constraint changelog_body_ar_is_doc
    check (body_ar is null or (jsonb_typeof(body_ar) = 'object' and body_ar ->> 'type' = 'doc')),
  add constraint changelog_body_en_is_doc
    check (body_en is null or (jsonb_typeof(body_en) = 'object' and body_en ->> 'type' = 'doc'));

-- Only needed for the conversion above.
drop function changelog_plain_to_doc(text);
