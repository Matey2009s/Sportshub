create table if not exists public.event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.sports_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists event_messages_event_created_idx
  on public.event_messages (event_id, created_at desc);

alter table public.event_messages enable row level security;

create policy "Event members can read event messages"
on public.event_messages for select
using (
  exists (
    select 1 from public.sports_events e
    where e.id = event_messages.event_id and e.organizer_id = (select auth.uid())
  )
  or exists (
    select 1 from public.event_participants p
    where p.event_id = event_messages.event_id
      and p.user_id = (select auth.uid())
      and p.participation_status = 'joined'
  )
);

create policy "Event members can send event messages"
on public.event_messages for insert
with check (
  user_id = (select auth.uid())
  and (
    exists (
      select 1 from public.sports_events e
      where e.id = event_messages.event_id and e.organizer_id = (select auth.uid())
    )
    or exists (
      select 1 from public.event_participants p
      where p.event_id = event_messages.event_id
        and p.user_id = (select auth.uid())
        and p.participation_status = 'joined'
    )
  )
);

alter publication supabase_realtime add table public.event_messages;
