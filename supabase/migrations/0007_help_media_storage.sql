-- Help center media library: the Storage bucket that holds article images.
--
-- Files are public (they appear on public pages); writes are admin-only. The
-- app uploads through a server route with the service key, so these policies
-- matter for anyone reaching Storage directly with a signed-in session.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'help-media',
  'help-media',
  true,
  8388608, -- 8 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "help media public read" on storage.objects
  for select using (bucket_id = 'help-media');

create policy "help media admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'help-media' and is_admin());

create policy "help media admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'help-media' and is_admin());

create policy "help media admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'help-media' and is_admin());
