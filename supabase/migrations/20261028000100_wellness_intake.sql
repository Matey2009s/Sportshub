-- Sensitive wellness answers are private and saved only with explicit user consent.
create table if not exists public.wellness_intakes (
 user_id uuid primary key references auth.users(id) on delete cascade,
 tobacco_response text not null check (tobacco_response in ('yes','no','prefer_not_to_say')),
 smoke_products text[] not null default '{}',
 alcohol_response text not null check (alcohol_response in ('yes','no','prefer_not_to_say')),
 awareness text null check (awareness in ('yes','no','not_sure')),
 consented_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.wellness_intakes enable row level security;
revoke all on public.wellness_intakes from anon, authenticated;
grant select, insert, update, delete on public.wellness_intakes to authenticated;
drop policy if exists "Users can read own wellness intake" on public.wellness_intakes;
create policy "Users can read own wellness intake" on public.wellness_intakes for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Users can save own wellness intake" on public.wellness_intakes;
create policy "Users can save own wellness intake" on public.wellness_intakes for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Users can update own wellness intake" on public.wellness_intakes;
create policy "Users can update own wellness intake" on public.wellness_intakes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "Users can delete own wellness intake" on public.wellness_intakes;
create policy "Users can delete own wellness intake" on public.wellness_intakes for delete to authenticated using (user_id = (select auth.uid()));