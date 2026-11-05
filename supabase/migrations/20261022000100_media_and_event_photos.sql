alter table public.sports_events
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sporthub-media', 'sporthub-media', true, 6291456, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "SportHub photos are public"
on storage.objects for select
using (bucket_id = 'sporthub-media');

create policy "Users upload their own SportHub photos"
on storage.objects for insert
with check (
  bucket_id = 'sporthub-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users update their own SportHub photos"
on storage.objects for update
using (
  bucket_id = 'sporthub-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'sporthub-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users delete their own SportHub photos"
on storage.objects for delete
using (
  bucket_id = 'sporthub-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
