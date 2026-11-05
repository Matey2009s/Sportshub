-- SportHub moderation. The moderator is granted by verified auth email and
-- the authorization check stays on the database (never trust a client flag).
create table if not exists public.sporthub_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.sporthub_moderators enable row level security;
revoke all on public.sporthub_moderators from anon, authenticated;

create or replace function public.is_sporthub_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sporthub_moderators m
    where m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_sporthub_moderator() from public;
grant execute on function public.is_sporthub_moderator() to authenticated;

create or replace function public.register_sporthub_moderator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(coalesce(new.email, '')) = 'mirovgogo@gmail.com' and new.email_confirmed_at is not null then
    insert into public.sporthub_moderators (user_id, email)
    values (new.id, lower(new.email))
    on conflict (user_id) do update set email = excluded.email;
  else
    delete from public.sporthub_moderators where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists register_sporthub_moderator on auth.users;
create trigger register_sporthub_moderator
after insert or update on auth.users
for each row execute function public.register_sporthub_moderator();

-- Grant the moderator role now if this account already exists. If it does not,
-- the auth.users trigger above grants it when the account is created.
insert into public.sporthub_moderators (user_id, email)
select id, lower(email)
from auth.users
where lower(coalesce(email, '')) = 'mirovgogo@gmail.com'
  and email_confirmed_at is not null
on conflict (user_id) do update set email = excluded.email;

create table if not exists public.user_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null default 'Community guidelines',
  banned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.user_bans enable row level security;
grant select, insert, delete on public.user_bans to authenticated;

drop policy if exists "Moderators can read user bans" on public.user_bans;
create policy "Moderators can read user bans"
on public.user_bans for select to authenticated
using (public.is_sporthub_moderator());

drop policy if exists "Moderators can ban users" on public.user_bans;
create policy "Moderators can ban users"
on public.user_bans for insert to authenticated
with check (
  public.is_sporthub_moderator()
  and banned_by = (select auth.uid())
  and user_id <> (select auth.uid())
);

drop policy if exists "Moderators can unban users" on public.user_bans;
create policy "Moderators can unban users"
on public.user_bans for delete to authenticated
using (public.is_sporthub_moderator());

create or replace function public.is_sporthub_user_banned()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_bans b where b.user_id = (select auth.uid()));
$$;

revoke all on function public.is_sporthub_user_banned() from public;
grant execute on function public.is_sporthub_user_banned() to authenticated;

-- A ban blocks writes/interactions while still allowing the account to sign in
-- and contact support. Each check is part of the database RLS policy.
drop policy if exists "Moderators can read all events" on public.sports_events;
create policy "Moderators can read all events"
on public.sports_events for select to authenticated
using (public.is_sporthub_moderator());

drop policy if exists "Users can create their own events" on public.sports_events;
create policy "Users can create their own events"
on public.sports_events for insert to authenticated
with check (organizer_id = (select auth.uid()) and not public.is_sporthub_user_banned());

drop policy if exists "Organizers can update their own events" on public.sports_events;
create policy "Organizers can update their own events"
on public.sports_events for update to authenticated
using (organizer_id = (select auth.uid()) and not public.is_sporthub_user_banned())
with check (organizer_id = (select auth.uid()) and not public.is_sporthub_user_banned());

drop policy if exists "Moderators can delete any event" on public.sports_events;
create policy "Moderators can delete any event"
on public.sports_events for delete to authenticated
using (public.is_sporthub_moderator());

drop policy if exists "Users can join an event as themselves" on public.event_participants;
create policy "Users can join an event as themselves"
on public.event_participants for insert to authenticated
with check (
  user_id = (select auth.uid())
  and not public.is_sporthub_user_banned()
  and participation_status = 'joined'
  and public.event_has_capacity(event_id)
);

drop policy if exists "Users can update their own participation record" on public.event_participants;
create policy "Users can update their own participation record"
on public.event_participants for update to authenticated
using (user_id = (select auth.uid()) and not public.is_sporthub_user_banned())
with check (user_id = (select auth.uid()) and not public.is_sporthub_user_banned());

drop policy if exists "Members can publish social posts" on public.social_posts;
create policy "Members can publish social posts"
on public.social_posts for insert to authenticated
with check (author_id = (select auth.uid()) and not public.is_sporthub_user_banned());

drop policy if exists "Authors can edit their social posts" on public.social_posts;
create policy "Authors can edit their social posts"
on public.social_posts for update to authenticated
using (author_id = (select auth.uid()) and not public.is_sporthub_user_banned())
with check (author_id = (select auth.uid()) and not public.is_sporthub_user_banned());

drop policy if exists "Moderators can delete any social post" on public.social_posts;
create policy "Moderators can delete any social post"
on public.social_posts for delete to authenticated
using (public.is_sporthub_moderator());

drop policy if exists "Members can like posts as themselves" on public.post_likes;
create policy "Members can like posts as themselves"
on public.post_likes for insert to authenticated
with check (user_id = (select auth.uid()) and not public.is_sporthub_user_banned());

drop policy if exists "Members can comment as themselves" on public.post_comments;
create policy "Members can comment as themselves"
on public.post_comments for insert to authenticated
with check (author_id = (select auth.uid()) and not public.is_sporthub_user_banned());

drop policy if exists "Moderators can delete any post comment" on public.post_comments;
create policy "Moderators can delete any post comment"
on public.post_comments for delete to authenticated
using (public.is_sporthub_moderator());

drop policy if exists "Event members can send event messages" on public.event_messages;
create policy "Event members can send event messages"
on public.event_messages for insert to authenticated
with check (
  user_id = (select auth.uid())
  and not public.is_sporthub_user_banned()
  and (
    exists (select 1 from public.sports_events e where e.id = event_messages.event_id and e.organizer_id = (select auth.uid()))
    or exists (select 1 from public.event_participants p where p.event_id = event_messages.event_id and p.user_id = (select auth.uid()) and p.participation_status = 'joined')
  )
);

drop policy if exists "Members can start direct conversations" on public.direct_conversations;
create policy "Members can start direct conversations"
on public.direct_conversations for insert to authenticated
with check (
  not public.is_sporthub_user_banned()
  and participant_one <> participant_two
  and ((participant_one = (select auth.uid())) or (participant_two = (select auth.uid())))
);

drop policy if exists "Members can send their own direct messages" on public.direct_messages;
create policy "Members can send their own direct messages"
on public.direct_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and not public.is_sporthub_user_banned()
  and exists (
    select 1 from public.direct_conversations c
    where c.id = direct_messages.conversation_id
      and ((c.participant_one = (select auth.uid())) or (c.participant_two = (select auth.uid())))
  )
);

drop policy if exists "Members can add own training logs" on public.training_logs;
create policy "Members can add own training logs"
on public.training_logs for insert to authenticated
with check (user_id = (select auth.uid()) and not public.is_sporthub_user_banned());

drop policy if exists "Members can edit own training logs" on public.training_logs;
create policy "Members can edit own training logs"
on public.training_logs for update to authenticated
using (user_id = (select auth.uid()) and not public.is_sporthub_user_banned())
with check (user_id = (select auth.uid()) and not public.is_sporthub_user_banned());
