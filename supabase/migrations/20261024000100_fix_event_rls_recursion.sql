-- Break the RLS cycle between sports_events and event_participants.
-- SECURITY DEFINER helpers read the related table as its owner, so evaluating
-- one table's policy does not recursively evaluate the other table's policy.

create or replace function public.is_current_user_event_participant(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_participants p
    where p.event_id = p_event_id
      and p.user_id = (select auth.uid())
      and p.participation_status = 'joined'
  );
$$;

revoke all on function public.is_current_user_event_participant(uuid) from public;
grant execute on function public.is_current_user_event_participant(uuid) to authenticated;

create or replace function public.is_scheduled_sports_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sports_events e
    where e.id = p_event_id
      and e.status = 'scheduled'
  );
$$;

revoke all on function public.is_scheduled_sports_event(uuid) from public;
grant execute on function public.is_scheduled_sports_event(uuid) to anon, authenticated;

-- Joining checks capacity in both tables; run this lookup outside their RLS
-- policies as well, otherwise inserts can trigger the same recursion.
create or replace function public.event_has_capacity(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select e.participant_capacity
      from public.sports_events e
      where e.id = p_event_id
    ) > (
      select count(*)
      from public.event_participants p
      where p.event_id = p_event_id
        and p.participation_status = 'joined'
    ),
    false
  );
$$;

revoke all on function public.event_has_capacity(uuid) from public;
grant execute on function public.event_has_capacity(uuid) to authenticated;

drop policy if exists "Users can view event participants" on public.event_participants;
create policy "Users can view event participants"
on public.event_participants for select to public
using (
  user_id = (select auth.uid())
  or public.is_scheduled_sports_event(event_id)
);

drop policy if exists "Participants can view joined event history" on public.sports_events;
create policy "Participants can view joined event history"
on public.sports_events for select to authenticated
using (
  organizer_id = (select auth.uid())
  or public.is_current_user_event_participant(id)
);
