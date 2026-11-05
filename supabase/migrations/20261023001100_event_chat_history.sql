-- Keep event details and group conversations available to people who joined,
-- even after the event date has passed or the organizer closes the event.
drop policy if exists "Participants can view joined event history" on public.sports_events;
create policy "Participants can view joined event history"
on public.sports_events for select to authenticated
using (
  organizer_id = (select auth.uid())
  or exists (
    select 1 from public.event_participants p
    where p.event_id = sports_events.id
      and p.user_id = (select auth.uid())
      and p.participation_status = 'joined'
  )
);
