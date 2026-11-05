create extension if not exists pgcrypto;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  biography text,
  favorite_sports text[] not null default '{}',
  skill_level text not null default 'beginner' check (skill_level in ('beginner', 'intermediate', 'advanced')),
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sports_events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) > 0),
  description text,
  sport_category text not null,
  starts_at timestamptz not null,
  duration_minutes integer,
  venue text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  participant_capacity integer not null check (participant_capacity > 0),
  skill_level text not null default 'beginner' check (skill_level in ('beginner', 'intermediate', 'advanced')),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.sports_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  participation_status text not null default 'joined' check (participation_status in ('joined', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists profiles_display_name_idx on public.profiles (display_name);
create index if not exists sports_events_starts_at_idx on public.sports_events (starts_at);
create index if not exists sports_events_organizer_idx on public.sports_events (organizer_id);
create index if not exists event_participants_event_idx on public.event_participants (event_id);
create index if not exists event_participants_user_idx on public.event_participants (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger sports_events_set_updated_at
before update on public.sports_events
for each row
execute function public.set_updated_at();

create or replace function public.event_has_capacity(p_event_id uuid)
returns boolean
language sql
stable
as $$
  select (
    (
      select participant_capacity
      from public.sports_events
      where id = p_event_id
    )
    > (
      select count(*)
      from public.event_participants
      where event_id = p_event_id
        and participation_status = 'joined'
    )
  );
$$;

alter table public.profiles enable row level security;
alter table public.sports_events enable row level security;
alter table public.event_participants enable row level security;

create policy "Profiles are viewable by owner"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Public events are readable"
on public.sports_events for select
using (status = 'scheduled' or organizer_id = auth.uid());

create policy "Users can create their own events"
on public.sports_events for insert
with check (organizer_id = auth.uid());

create policy "Organizers can update their own events"
on public.sports_events for update
using (organizer_id = auth.uid())
with check (organizer_id = auth.uid());

create policy "Organizers can delete their own events"
on public.sports_events for delete
using (organizer_id = auth.uid());

create policy "Users can view event participants"
on public.event_participants for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.sports_events e
    where e.id = event_participants.event_id
      and e.status = 'scheduled'
  )
);

create policy "Users can join an event as themselves"
on public.event_participants for insert
with check (
  auth.uid() = user_id
  and participation_status = 'joined'
  and public.event_has_capacity(event_id)
);

create policy "Users can leave their own joined events"
on public.event_participants for delete
using (auth.uid() = user_id);

create policy "Users can update their own participation record"
on public.event_participants for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
