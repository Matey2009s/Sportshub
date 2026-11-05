alter table public.social_posts
  add column if not exists image_urls text[] not null default '{}'::text[];

update public.social_posts
set image_urls = array[image_url]
where image_url is not null
  and cardinality(image_urls) = 0;

alter table public.social_posts
  drop constraint if exists social_posts_content_check;

alter table public.social_posts
  add constraint social_posts_content_check check (
    char_length(body) <= 2000
    and (char_length(trim(body)) > 0 or image_url is not null or cardinality(image_urls) > 0)
  );

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  participant_one uuid not null references auth.users(id) on delete cascade,
  participant_two uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint direct_conversations_pair_check check (participant_one < participant_two),
  constraint direct_conversations_pair_unique unique (participant_one, participant_two)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists direct_conversations_one_updated_idx
  on public.direct_conversations (participant_one, updated_at desc);
create index if not exists direct_conversations_two_updated_idx
  on public.direct_conversations (participant_two, updated_at desc);
create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages (conversation_id, created_at asc);

create or replace function public.touch_direct_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.direct_conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists direct_messages_touch_conversation on public.direct_messages;
create trigger direct_messages_touch_conversation
after insert on public.direct_messages
for each row execute function public.touch_direct_conversation();

alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "Conversation members can read direct conversations" on public.direct_conversations;
create policy "Conversation members can read direct conversations"
on public.direct_conversations for select
using (participant_one = (select auth.uid()) or participant_two = (select auth.uid()));

drop policy if exists "Members can start direct conversations" on public.direct_conversations;
create policy "Members can start direct conversations"
on public.direct_conversations for insert
with check (
  participant_one <> participant_two
  and ((participant_one = (select auth.uid())) or (participant_two = (select auth.uid())))
);

drop policy if exists "Conversation members can read direct messages" on public.direct_messages;
create policy "Conversation members can read direct messages"
on public.direct_messages for select
using (
  exists (
    select 1 from public.direct_conversations c
    where c.id = direct_messages.conversation_id
      and ((c.participant_one = (select auth.uid())) or (c.participant_two = (select auth.uid())))
  )
);

drop policy if exists "Members can send their own direct messages" on public.direct_messages;
create policy "Members can send their own direct messages"
on public.direct_messages for insert
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.direct_conversations c
    where c.id = direct_messages.conversation_id
      and ((c.participant_one = (select auth.uid())) or (c.participant_two = (select auth.uid())))
  )
);

alter publication supabase_realtime add table public.direct_conversations;
alter publication supabase_realtime add table public.direct_messages;
