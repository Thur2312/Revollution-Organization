-- 0003_rls_policies.sql
-- Row Level Security: every row is scoped to the caller's workspace
-- membership. owner/admin/member can create & edit; guest is read-only
-- except comments/attachments, where guests are expected to participate.

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.teams enable row level security;
alter table public.memberships enable row level security;
alter table public.boards enable row level security;
alter table public.board_columns enable row level security;
alter table public.cards enable row level security;
alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;

-- profiles: MVP simplification — any authenticated user can read any
-- profile (needed to render names on comments/cards/members lists across
-- workspaces); only the row owner can edit it.
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- workspaces
create policy "workspaces_select_member" on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));

create policy "workspaces_insert_own" on public.workspaces
  for insert to authenticated with check (owner_id = auth.uid());

create policy "workspaces_update_admin" on public.workspaces
  for update to authenticated
  using (public.is_workspace_admin(id))
  with check (public.is_workspace_admin(id));

create policy "workspaces_delete_owner" on public.workspaces
  for delete to authenticated using (public.is_workspace_owner(id));

-- teams
create policy "teams_select_member" on public.teams
  for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "teams_cud_admin" on public.teams
  for all to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- memberships: members see the roster; only admins manage it, plus any
-- member can remove themselves (leave workspace).
create policy "memberships_select_member" on public.memberships
  for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "memberships_insert_admin" on public.memberships
  for insert to authenticated with check (public.is_workspace_admin(workspace_id));

create policy "memberships_update_admin" on public.memberships
  for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

create policy "memberships_delete_admin_or_self" on public.memberships
  for delete to authenticated
  using (public.is_workspace_admin(workspace_id) or user_id = auth.uid());

-- boards
create policy "boards_select_member" on public.boards
  for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "boards_cud_editor" on public.boards
  for all to authenticated
  using (public.can_edit_workspace(workspace_id))
  with check (public.can_edit_workspace(workspace_id));

-- board_columns
create policy "columns_select_member" on public.board_columns
  for select to authenticated
  using (public.is_workspace_member(public.workspace_of_board(board_id)));

create policy "columns_cud_editor" on public.board_columns
  for all to authenticated
  using (public.can_edit_workspace(public.workspace_of_board(board_id)))
  with check (public.can_edit_workspace(public.workspace_of_board(board_id)));

-- cards
create policy "cards_select_member" on public.cards
  for select to authenticated
  using (public.is_workspace_member(public.workspace_of_column(column_id)));

create policy "cards_cud_editor" on public.cards
  for all to authenticated
  using (public.can_edit_workspace(public.workspace_of_column(column_id)))
  with check (public.can_edit_workspace(public.workspace_of_column(column_id)));

-- checklists
create policy "checklists_select_member" on public.checklists
  for select to authenticated
  using (public.is_workspace_member(public.workspace_of_card(card_id)));

create policy "checklists_cud_editor" on public.checklists
  for all to authenticated
  using (public.can_edit_workspace(public.workspace_of_card(card_id)))
  with check (public.can_edit_workspace(public.workspace_of_card(card_id)));

-- checklist_items
create policy "checklist_items_select_member" on public.checklist_items
  for select to authenticated
  using (public.is_workspace_member(public.workspace_of_checklist(checklist_id)));

create policy "checklist_items_cud_editor" on public.checklist_items
  for all to authenticated
  using (public.can_edit_workspace(public.workspace_of_checklist(checklist_id)))
  with check (public.can_edit_workspace(public.workspace_of_checklist(checklist_id)));

-- comments: any workspace member (including guest) can post; only the
-- author or an admin can edit/delete.
create policy "comments_select_member" on public.comments
  for select to authenticated
  using (public.is_workspace_member(public.workspace_of_card(card_id)));

create policy "comments_insert_member" on public.comments
  for insert to authenticated with check (
    public.is_workspace_member(public.workspace_of_card(card_id))
    and user_id = auth.uid()
  );

create policy "comments_update_own" on public.comments
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "comments_delete_own_or_admin" on public.comments
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_workspace_admin(public.workspace_of_card(card_id))
  );

-- attachments: any workspace member (including guest) can upload; only
-- the uploader or an admin can delete.
create policy "attachments_select_member" on public.attachments
  for select to authenticated
  using (public.is_workspace_member(public.workspace_of_card(card_id)));

create policy "attachments_insert_member" on public.attachments
  for insert to authenticated with check (
    public.is_workspace_member(public.workspace_of_card(card_id))
    and uploaded_by = auth.uid()
  );

create policy "attachments_delete_own_or_admin" on public.attachments
  for delete to authenticated
  using (
    uploaded_by = auth.uid()
    or public.is_workspace_admin(public.workspace_of_card(card_id))
  );
