-- 0011_open_signup_invites.sql
-- Product pivot: signup goes from invite-gated to open (any email), and
-- workspace invites become GitHub-style — an admin can invite someone who
-- ALREADY has an account (found via search) or a brand new email, but
-- either way the invite always sits pending until the invitee explicitly
-- accepts it (no more silent auto-add for existing profiles, and no more
-- auto-accept-on-signup for pending emails). This migration only touches
-- schema/functions; the signup-gate Auth Hook from 0008 is disabled
-- separately via the Management API (project-level config, not SQL).

alter table public.profiles add column company text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, company)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'company'
  );
  return new;
end;
$$;

-- Auto-accept-on-signup is gone: every invite now needs an explicit
-- accept_workspace_invite() call, even for emails that already had a
-- pending invite waiting when they signed up.
drop trigger if exists on_profile_created_accept_invites on public.profiles;
drop function if exists public.accept_pending_invites();

-- invite_member(): previously added an existing profile to the workspace
-- immediately (no acceptance step) and only queued a pending row for
-- brand-new emails. Now it ALWAYS queues a pending row — membership is
-- only ever created by the invitee calling accept_workspace_invite().
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

  if v_existing_user_id is not null and exists (
    select 1 from public.memberships
    where user_id = v_existing_user_id and workspace_id = p_workspace_id
  ) then
    raise exception 'this person is already a member of this workspace';
  end if;

  insert into public.workspace_invites (workspace_id, email, role, invited_by)
  values (p_workspace_id, v_email, p_role, auth.uid())
  on conflict (workspace_id, lower(email)) where accepted_at is null
  do update set role = excluded.role, invited_by = excluded.invited_by;

  if v_existing_user_id is not null then
    return 'existing';
  end if;
  return 'new';
end;
$$;

-- Invitee-facing: accept a pending invite addressed to their own email.
-- SECURITY DEFINER so it can insert into memberships (normally
-- admin-only per memberships_insert_admin) — the function itself enforces
-- that only the matching invitee can call it successfully.
create or replace function public.accept_workspace_invite(p_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.workspace_invites;
  v_my_email text;
begin
  select email into v_my_email from public.profiles where id = auth.uid();

  select * into v_invite
  from public.workspace_invites
  where id = p_invite_id and accepted_at is null
  for update;

  if not found then
    raise exception 'invite not found or already handled';
  end if;

  if lower(v_invite.email) <> lower(coalesce(v_my_email, '')) then
    raise exception 'this invite is not for your account';
  end if;

  insert into public.memberships (user_id, workspace_id, role, invited_by)
  values (auth.uid(), v_invite.workspace_id, v_invite.role, v_invite.invited_by)
  on conflict (user_id, workspace_id) do nothing;

  update public.workspace_invites set accepted_at = now() where id = p_invite_id;

  return v_invite.workspace_id;
end;
$$;

create or replace function public.decline_workspace_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.workspace_invites
  where id = p_invite_id
    and accepted_at is null
    and lower(email) = lower(coalesce((select email from public.profiles where id = auth.uid()), ''));
end;
$$;

-- Invitee-facing inbox feed. SECURITY DEFINER so it can read workspace
-- names/inviter names the caller isn't a member of yet (workspaces' own
-- SELECT policy is member-only, which the invitee by definition isn't).
create or replace function public.my_pending_invites()
returns table (
  id uuid,
  workspace_id uuid,
  workspace_name text,
  role public.member_role,
  invited_by_name text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select wi.id, wi.workspace_id, w.name, wi.role,
         coalesce(p.full_name, p.email, 'Alguém'), wi.created_at
  from public.workspace_invites wi
  join public.workspaces w on w.id = wi.workspace_id
  left join public.profiles p on p.id = wi.invited_by
  where wi.accepted_at is null
    and lower(wi.email) = lower(coalesce((select email from public.profiles where id = auth.uid()), ''))
  order by wi.created_at desc;
$$;

-- GitHub-style "invite by searching an existing user" — returns only
-- id/email/full_name (no other profile data), requires 3+ chars so it
-- can't be used to enumerate the whole user table one keystroke at a time,
-- and excludes the caller.
create or replace function public.search_users_by_email(p_query text)
returns table (id uuid, email text, full_name text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.email, p.full_name
  from public.profiles p
  where length(trim(p_query)) >= 3
    and lower(p.email) like lower(trim(p_query)) || '%'
    and p.id <> auth.uid()
  order by p.email
  limit 8;
$$;

grant execute on function public.accept_workspace_invite(uuid) to authenticated;
grant execute on function public.decline_workspace_invite(uuid) to authenticated;
grant execute on function public.my_pending_invites() to authenticated;
grant execute on function public.search_users_by_email(text) to authenticated;
