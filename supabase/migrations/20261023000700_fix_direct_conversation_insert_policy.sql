drop policy if exists "Members can start direct conversations"
  on public.direct_conversations;

create policy "Members can start direct conversations"
on public.direct_conversations for insert
with check (
  participant_one <> participant_two
  and ((participant_one = (select auth.uid())) or (participant_two = (select auth.uid())))
);
