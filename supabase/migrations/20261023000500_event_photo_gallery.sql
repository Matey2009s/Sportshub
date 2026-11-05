alter table public.sports_events
  add column if not exists image_urls text[] not null default '{}'::text[];

update public.sports_events
set image_urls = array[image_url]
where image_url is not null
  and cardinality(image_urls) = 0;
