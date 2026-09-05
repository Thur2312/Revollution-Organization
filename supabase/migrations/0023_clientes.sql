-- 0023_clientes.sql
-- Cadastro de cliente vira uma entidade própria por workspace (clientes),
-- em vez dos campos cliente_nome/cliente_email soltos direto em
-- processos_inpi (0022) — assim o mesmo cliente é reaproveitado entre
-- vários processos (cadastra uma vez, escolhe da lista depois) e o
-- cadastro completo (documento, telefone, observações) vive num lugar só.
-- Sem backfill de dados: a feature é nova o bastante pra não ter cliente_*
-- populado em produção ainda.

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  nome text,
  email text,
  documento text,
  telefone text,
  observacoes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index idx_clientes_workspace on public.clientes (workspace_id);

alter table public.clientes enable row level security;

create policy "clientes_select_member" on public.clientes
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "clientes_cud_editor" on public.clientes
  for all to authenticated
  using (public.can_edit_workspace(workspace_id))
  with check (public.can_edit_workspace(workspace_id));

alter table public.processos_inpi
  add column cliente_id uuid references public.clientes (id) on delete set null;

alter table public.processos_inpi drop column cliente_nome;
alter table public.processos_inpi drop column cliente_email;
