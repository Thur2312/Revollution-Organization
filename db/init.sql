-- Supabase initial schema and RLS policies for Revollution Idea
create extension if not exists "pgcrypto";

-- Tables
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null,
  created_at timestamptz default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workspace_id uuid references workspaces(id) on delete cascade,
  role text default 'member'
);

create table if not exists boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade,
  title text,
  position int default 0
);

create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  column_id uuid references columns(id) on delete cascade,
  title text,
  description text,
  position int default 0,
  created_at timestamptz default now()
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  user_id uuid not null,
  body text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table workspaces enable row level security;
alter table memberships enable row level security;
alter table boards enable row level security;
alter table columns enable row level security;
alter table cards enable row level security;
alter table comments enable row level security;

-- Policies
-- Memberships: insert allowed for authenticated users (checking user_id matches auth.uid())
create policy insert_memberships_auth on memberships
  for insert with check (auth.uid() is not null and user_id = auth.uid());

-- Workspaces: only owner can delete; members can select
create policy select_workspaces_for_members on workspaces
  for select using (
    exists (select 1 from memberships m where m.workspace_id = workspaces.id and m.user_id = auth.uid())
  );

create policy insert_workspaces_auth on workspaces
  for insert with check (auth.uid() is not null and owner_id = auth.uid());

create policy delete_workspaces_owner on workspaces
  for delete using (owner_id = auth.uid());

-- Boards: members of workspace can select/insert/update/delete if role allows
create policy boards_select_for_members on boards
  for select using (
    exists (select 1 from memberships m where m.workspace_id = boards.workspace_id and m.user_id = auth.uid())
  );

create policy boards_mod_for_members on boards
  for all using (
    exists (select 1 from memberships m where m.workspace_id = boards.workspace_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from memberships m where m.workspace_id = boards.workspace_id and m.user_id = auth.uid())
  );

-- Columns and Cards: allow operations for members of the parent workspace
create policy columns_membership on columns
  for all using (
    exists (select 1 from boards b join memberships m on b.workspace_id = m.workspace_id where b.id = columns.board_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from boards b join memberships m on b.workspace_id = m.workspace_id where b.id = columns.board_id and m.user_id = auth.uid())
  );

create policy cards_membership on cards
  for all using (
    exists (select 1 from columns c join boards b on c.board_id = b.id join memberships m on b.workspace_id = m.workspace_id where c.id = cards.column_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from columns c join boards b on c.board_id = b.id join memberships m on b.workspace_id = m.workspace_id where c.id = cards.column_id and m.user_id = auth.uid())
  );

-- Comments: same as cards
create policy comments_membership on comments
  for all using (
    exists (select 1 from cards c join columns col on c.column_id = col.id join boards b on col.board_id = b.id join memberships m on b.workspace_id = m.workspace_id where c.id = comments.card_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from cards c join columns col on c.column_id = col.id join boards b on col.board_id = b.id join memberships m on b.workspace_id = m.workspace_id where c.id = comments.card_id and m.user_id = auth.uid())
  );

-- End of init.sql
