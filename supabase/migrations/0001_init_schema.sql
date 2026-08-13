-- 0001_init_schema.sql
-- Core schema: profiles, workspaces, teams, memberships, boards, columns,
-- cards, checklists, checklist_items, comments, attachments.

create extension if not exists "pgcrypto";

create type public.member_role as enum ('owner', 'admin', 'member', 'guest');

-- Mirrors auth.users with public-safe profile fields.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references public.profiles (id),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  role public.member_role not null default 'member',
  invited_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (user_id, workspace_id)
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  name text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Named board_columns (not "columns") to avoid clashing with the
-- information_schema.columns view and keep queries unambiguous.
create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references public.board_columns (id) on delete cascade,
  title text not null,
  description text,
  position integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  title text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists (id) on delete cascade,
  text text not null,
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index idx_teams_workspace on public.teams (workspace_id);
create index idx_memberships_workspace on public.memberships (workspace_id);
create index idx_memberships_user on public.memberships (user_id);
create index idx_boards_workspace on public.boards (workspace_id);
create index idx_board_columns_board on public.board_columns (board_id, position);
create index idx_cards_column on public.cards (column_id, position);
create index idx_checklists_card on public.checklists (card_id);
create index idx_checklist_items_checklist on public.checklist_items (checklist_id);
create index idx_comments_card on public.comments (card_id, created_at);
create index idx_attachments_card on public.attachments (card_id);
