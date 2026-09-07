-- 0026_agenda_google.sql
-- Agenda de compromissos por workspace, sincronizada com o Google Agenda
-- de cada colaborador.
--
-- google_calendar_connections guarda o refresh/access token OAuth de
-- quem conectou a própria conta Google — isso nunca deve ser lido pelo
-- client, então RLS fica ligado SEM nenhuma policy pra authenticated
-- (nem select): só a service role (rotas server-side em
-- src/app/api/auth/google/*, src/app/api/agenda/*) toca essa tabela.
create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  google_email text,
  access_token text not null,
  refresh_token text not null,
  token_expiry timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_connections enable row level security;

-- compromissos: visível pra todo o workspace (pra evitar marcar em cima
-- de compromisso alheio), mas só o dono (user_id = quem vai receber o
-- evento na própria agenda Google) ou um admin pode editar/remover.
create table if not exists public.compromissos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  titulo text not null,
  descricao text,
  local text,
  inicio timestamptz not null,
  fim timestamptz not null,
  google_event_id text,
  status_sincronizacao text not null default 'pendente'
    check (status_sincronizacao in ('pendente', 'sincronizado', 'falha', 'nao_conectado')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_compromissos_workspace on public.compromissos (workspace_id, inicio);
create index if not exists idx_compromissos_user on public.compromissos (user_id);

alter table public.compromissos enable row level security;

create trigger set_updated_at before update on public.compromissos
  for each row execute function public.set_updated_at();

drop policy if exists "compromissos_select_member" on public.compromissos;
create policy "compromissos_select_member" on public.compromissos
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- Só cria compromisso na própria agenda (user_id = quem está logado),
-- precisando poder editar o workspace.
drop policy if exists "compromissos_insert_own" on public.compromissos;
create policy "compromissos_insert_own" on public.compromissos
  for insert to authenticated
  with check (public.can_edit_workspace(workspace_id) and user_id = auth.uid());

drop policy if exists "compromissos_update_own_or_admin" on public.compromissos;
create policy "compromissos_update_own_or_admin" on public.compromissos
  for update to authenticated
  using (user_id = auth.uid() or public.is_workspace_admin(workspace_id))
  with check (user_id = auth.uid() or public.is_workspace_admin(workspace_id));

drop policy if exists "compromissos_delete_own_or_admin" on public.compromissos;
create policy "compromissos_delete_own_or_admin" on public.compromissos
  for delete to authenticated
  using (user_id = auth.uid() or public.is_workspace_admin(workspace_id));
