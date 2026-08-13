-- 0005_invites.sql
-- Email-based invites so a workspace admin can invite someone who hasn't
-- signed up yet (the pattern memberships alone can't cover, since it only
-- links to an existing profiles.id). If the invited email already has a
-- profile, invite_member() creates the membership immediately; otherwise it
-- queues a pending row that accept_pending_invites() resolves the moment
-- that email finishes signup.

create index idx_profiles_email on public.profiles (lower(email));

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role public.member_role not null default 'member',
  invited_by uuid not null references public.profiles (id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Only one live (unaccepted) invite per email per workspace; re-inviting
-- before acceptance updates the existing row instead of duplicating it.
create unique index idx_workspace_invites_pending
  on public.workspace_invites (workspace_id, lower(email))
  where accepted_at is null;

create index idx_workspace_invites_workspace on public.workspace_invites (workspace_id);

alter table public.workspace_invites enable row level security;

-- Read/revoke are admin-only, same bar as managing memberships directly.
-- There is deliberately no insert/update policy here: all writes go
-- through invite_member() / accept_pending_invites() below, both
-- SECURITY DEFINER, so this table's RLS only needs to gate reads + revoke.
create policy "invites_select_admin" on public.workspace_invites
  for select to authenticated using (public.is_workspace_admin(workspace_id));

create policy "invites_delete_admin" on public.workspace_invites
  for delete to authenticated using (public.is_workspace_admin(workspace_id));

-- Single entry point for "invite a member by email" from the frontend.
-- Enforces the admin check itself (belt-and-braces: it's SECURITY DEFINER,
-- so table RLS alone wouldn't stop a non-admin from calling it).
create or replace function public.invite_member(
  p_workspace_id uuid,
  p_email text,
  p_role public.member_role default 'member'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_existing_user_id uuid;
begin
  if not public.is_workspace_admin(p_workspace_id) then
    raise exception 'only workspace admins can invite members';
  end if;

  if p_role = 'owner' then
    raise exception 'cannot invite directly as owner';
  end if;

  select id into v_existing_user_id
  from public.profiles
  where lower(email) = v_email
  limit 1;

  if v_existing_user_id is not null then
    insert into public.memberships (user_id, workspace_id, role, invited_by)
    values (v_existing_user_id, p_workspace_id, p_role, auth.uid())
    on conflict (user_id, workspace_id) do update set role = excluded.role;

    return 'added';
  end if;

  insert into public.workspace_invites (workspace_id, email, role, invited_by)
  values (p_workspace_id, v_email, p_role, auth.uid())
  on conflict (workspace_id, lower(email)) where accepted_at is null
  do update set role = excluded.role, invited_by = excluded.invited_by;

  return 'invited';
end;
$$;

-- Fires after handle_new_user() has created the profile row, so new.email
-- is available here to resolve any invites that were waiting on it.
create or replace function public.accept_pending_invites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.memberships (user_id, workspace_id, role, invited_by)
  select new.id, wi.workspace_id, wi.role, wi.invited_by
  from public.workspace_invites wi
  where lower(wi.email) = lower(new.email) and wi.accepted_at is null
  on conflict (user_id, workspace_id) do nothing;

  update public.workspace_invites
  set accepted_at = now()
  where lower(email) = lower(new.email) and accepted_at is null;

  return new;
end;
$$;

create trigger on_profile_created_accept_invites
  after insert on public.profiles
  for each row execute function public.accept_pending_invites();
