-- 0019_platform_admin_and_time_tracking.sql
-- Two pieces of new infrastructure:
--   1. A platform-wide admin flag (profiles.is_platform_admin), separate
--      from per-workspace member_role, gating a cross-workspace tasks
--      dashboard and the timesheet view. Protected by a trigger so it can
--      only be set via a service-role connection, never by a client update.
--   2. time_entries: one row per user per calendar day, auto-managed by the
--      client (session heartbeat) to show how many hours each collaborator
--      was active on the platform.

alter table public.profiles add column is_platform_admin boolean not null default false;

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_platform_admin from public.profiles where id = auth.uid()), false);
$$;

-- profiles_update_own only checks row ownership, not which columns changed,
-- so without this a user could self-grant admin via a normal client update.
create or replace function public.protect_platform_admin_flag()
returns trigger
language plpgsql
as $$
begin
  if new.is_platform_admin is distinct from old.is_platform_admin and auth.role() = 'authenticated' then
    new.is_platform_admin := old.is_platform_admin;
  end if;
  return new;
end;
$$;

create trigger protect_platform_admin_flag before update on public.profiles
  for each row execute function public.protect_platform_admin_flag();

-- Cross-workspace read access for platform admins (tasks dashboard). These
-- are additional permissive SELECT policies — they widen access, they don't
-- replace the existing membership-scoped ones.
create policy "workspaces_select_platform_admin" on public.workspaces
  for select to authenticated using (public.is_platform_admin());

create policy "boards_select_platform_admin" on public.boards
  for select to authenticated using (public.is_platform_admin());

create policy "columns_select_platform_admin" on public.board_columns
  for select to authenticated using (public.is_platform_admin());

create policy "cards_select_platform_admin" on public.cards
  for select to authenticated using (public.is_platform_admin());

-- time_entries: client-managed session heartbeat, one row per user per day.
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  work_date date not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (user_id, work_date)
);

create index idx_time_entries_date on public.time_entries (work_date);
create index idx_time_entries_user on public.time_entries (user_id);

alter table public.time_entries enable row level security;

create policy "time_entries_select_own" on public.time_entries
  for select to authenticated using (user_id = auth.uid());

create policy "time_entries_select_platform_admin" on public.time_entries
  for select to authenticated using (public.is_platform_admin());

create policy "time_entries_insert_own" on public.time_entries
  for insert to authenticated with check (user_id = auth.uid());

create policy "time_entries_update_own" on public.time_entries
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
