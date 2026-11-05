create table if not exists public.training_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sport_category text not null,
  duration_minutes integer not null check (duration_minutes between 1 and 600),
  note text,
  performed_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists training_logs_user_performed_idx
  on public.training_logs (user_id, performed_at desc);

alter table public.training_logs enable row level security;

grant select, insert, update, delete on table public.training_logs to authenticated;

drop policy if exists "Members can read own training logs" on public.training_logs;
create policy "Members can read own training logs"
  on public.training_logs for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Members can add own training logs" on public.training_logs;
create policy "Members can add own training logs"
  on public.training_logs for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Members can edit own training logs" on public.training_logs;
create policy "Members can edit own training logs"
  on public.training_logs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Members can delete own training logs" on public.training_logs;
create policy "Members can delete own training logs"
  on public.training_logs for delete to authenticated
  using (user_id = (select auth.uid()));
