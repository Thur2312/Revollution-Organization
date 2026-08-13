-- 0002_functions_triggers.sql
-- updated_at maintenance, auth.users -> profiles sync, workspace owner
-- bootstrap, and RLS helper functions (SECURITY DEFINER to dodge
-- recursive-RLS lookups on memberships/boards/columns/cards).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.boards
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.cards
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

-- Creates the public profile row right after Supabase Auth creates the user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Whoever creates a workspace becomes its owner membership.
create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.memberships (user_id, workspace_id, role)
  values (new.owner_id, new.id, 'owner');
  return new;
end;
$$;

create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

create or replace function public.workspace_role(p_workspace_id uuid)
returns public.member_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.memberships
  where workspace_id = p_workspace_id and user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where workspace_id = p_workspace_id and user_id = auth.uid()
  );
$$;

-- owner/admin/member can create and edit content; guest is read (+comment/upload) only.
create or replace function public.can_edit_workspace(p_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'member')
  );
$$;

create or replace function public.is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- Resolve workspace_id from nested entities so every RLS policy can reuse
-- the same is_workspace_member / can_edit_workspace / is_workspace_admin checks.
create or replace function public.workspace_of_board(p_board_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select workspace_id from public.boards where id = p_board_id;
$$;

create or replace function public.workspace_of_column(p_column_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select b.workspace_id
  from public.board_columns c
  join public.boards b on b.id = c.board_id
  where c.id = p_column_id;
$$;

create or replace function public.workspace_of_card(p_card_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select b.workspace_id
  from public.cards ca
  join public.board_columns c on c.id = ca.column_id
  join public.boards b on b.id = c.board_id
  where ca.id = p_card_id;
$$;

create or replace function public.workspace_of_checklist(p_checklist_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select public.workspace_of_card(card_id)
  from public.checklists
  where id = p_checklist_id;
$$;
