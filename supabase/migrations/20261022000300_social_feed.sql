create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Athlete',
  author_avatar_url text,
  body text not null default '',
  image_url text,
  sport_category text,
  created_at timestamptz not null default now(),
  constraint social_posts_content_check check (
    char_length(body) <= 2000 and (char_length(trim(body)) > 0 or image_url is not null)
  )
);

create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Athlete',
  author_avatar_url text,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists social_posts_created_idx on public.social_posts (created_at desc);
create index if not exists post_likes_post_idx on public.post_likes (post_id);
create index if not exists post_comments_post_created_idx on public.post_comments (post_id, created_at);

create or replace function public.set_social_post_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(nullif(trim(p.display_name), ''), 'Athlete'), p.avatar_url
    into new.author_name, new.author_avatar_url
    from public.profiles p
    where p.id = new.author_id;
  if new.author_name is null then new.author_name := 'Athlete'; end if;
  return new;
end;
$$;

drop trigger if exists social_posts_set_author on public.social_posts;
create trigger social_posts_set_author
before insert or update on public.social_posts
for each row execute function public.set_social_post_author();

drop trigger if exists post_comments_set_author on public.post_comments;
create trigger post_comments_set_author
before insert on public.post_comments
for each row execute function public.set_social_post_author();

alter table public.social_posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

drop policy if exists "Social posts are public" on public.social_posts;
create policy "Social posts are public"
on public.social_posts for select using (true);

drop policy if exists "Members can publish social posts" on public.social_posts;
create policy "Members can publish social posts"
on public.social_posts for insert with check (author_id = (select auth.uid()));

drop policy if exists "Authors can edit their social posts" on public.social_posts;
create policy "Authors can edit their social posts"
on public.social_posts for update
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

drop policy if exists "Authors can delete their social posts" on public.social_posts;
create policy "Authors can delete their social posts"
on public.social_posts for delete using (author_id = (select auth.uid()));

drop policy if exists "Post likes are public" on public.post_likes;
create policy "Post likes are public" on public.post_likes for select using (true);

drop policy if exists "Members can like posts as themselves" on public.post_likes;
create policy "Members can like posts as themselves"
on public.post_likes for insert with check (user_id = (select auth.uid()));

drop policy if exists "Members can remove their own likes" on public.post_likes;
create policy "Members can remove their own likes"
on public.post_likes for delete using (user_id = (select auth.uid()));

drop policy if exists "Post comments are public" on public.post_comments;
create policy "Post comments are public" on public.post_comments for select using (true);

drop policy if exists "Members can comment as themselves" on public.post_comments;
create policy "Members can comment as themselves"
on public.post_comments for insert with check (author_id = (select auth.uid()));

drop policy if exists "Authors can delete their comments" on public.post_comments;
create policy "Authors can delete their comments"
on public.post_comments for delete using (author_id = (select auth.uid()));
