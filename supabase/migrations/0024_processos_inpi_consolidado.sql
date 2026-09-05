-- 0024_processos_inpi_consolidado.sql
-- Migration "total": converge processos_inpi/eventos_processo_inpi/
-- clientes pro estado final correto, rodando com segurança independente
-- de quanto de 0021/0022/0023 já tiver sido aplicado em produção antes
-- (não sabemos ao certo até onde o `db push` já rodou) — todo passo usa
-- IF NOT EXISTS / IF EXISTS / DROP ... IF EXISTS antes de recriar, então
-- é seguro rodar mesmo que parte disso já exista.
--
-- Não reaproveita os números 0021-0023: se essas versions já estiverem
-- marcadas como aplicadas no histórico do Supabase, um arquivo com o
-- mesmo nome seria simplesmente pulado pelo `db push` e o conteúdo novo
-- nunca rodaria — daí o número novo, pra garantir que isto sempre execute.

create table if not exists public.clientes (
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

create index if not exists idx_clientes_workspace on public.clientes (workspace_id);

alter table public.clientes enable row level security;

drop policy if exists "clientes_select_member" on public.clientes;
create policy "clientes_select_member" on public.clientes
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "clientes_cud_editor" on public.clientes;
create policy "clientes_cud_editor" on public.clientes
  for all to authenticated
  using (public.can_edit_workspace(workspace_id))
  with check (public.can_edit_workspace(workspace_id));

create table if not exists public.processos_inpi (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  numero_processo text not null,
  tipo text not null check (tipo in ('marca', 'patente', 'desenho_industrial')),
  apelido text,
  nome text,
  situacao text,
  despacho_codigo text,
  despacho_descricao text,
  despacho_data date,
  numero_rpi text,
  dados_atualizados_ate date,
  titular text,
  apresentacao text,
  natureza text,
  classe text,
  ultima_verificacao_em timestamptz,
  ativo boolean not null default true,
  cliente_id uuid references public.clientes (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (workspace_id, numero_processo, tipo)
);

-- Cobre o caso em que processos_inpi já existia (de uma 0021 aplicada
-- antes desta migration existir) sem cliente_id ainda.
alter table public.processos_inpi
  add column if not exists cliente_id uuid references public.clientes (id) on delete set null;

-- Cobre o caso em que 0022 (cliente_nome/cliente_email direto na tabela,
-- versão descartada em favor da tabela clientes) já tiver sido aplicada.
alter table public.processos_inpi drop column if exists cliente_nome;
alter table public.processos_inpi drop column if exists cliente_email;

create index if not exists idx_processos_inpi_workspace on public.processos_inpi (workspace_id);
create index if not exists idx_processos_inpi_ativo on public.processos_inpi (ativo);
create index if not exists idx_processos_inpi_cliente on public.processos_inpi (cliente_id);

alter table public.processos_inpi enable row level security;

create table if not exists public.eventos_processo_inpi (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos_inpi (id) on delete cascade,
  despacho_codigo text,
  despacho_descricao text not null,
  despacho_data date,
  situacao text,
  encontrado_em timestamptz not null default now(),
  lido boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_eventos_processo_inpi_processo
  on public.eventos_processo_inpi (processo_id, encontrado_em desc);

alter table public.eventos_processo_inpi enable row level security;

create or replace function public.workspace_of_processo_inpi(p_processo_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select workspace_id from public.processos_inpi where id = p_processo_id;
$$;

drop policy if exists "processos_inpi_select_member" on public.processos_inpi;
create policy "processos_inpi_select_member" on public.processos_inpi
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "processos_inpi_cud_editor" on public.processos_inpi;
create policy "processos_inpi_cud_editor" on public.processos_inpi
  for all to authenticated
  using (public.can_edit_workspace(workspace_id))
  with check (public.can_edit_workspace(workspace_id));

drop policy if exists "eventos_processo_inpi_select_member" on public.eventos_processo_inpi;
create policy "eventos_processo_inpi_select_member" on public.eventos_processo_inpi
  for select to authenticated
  using (public.is_workspace_member(public.workspace_of_processo_inpi(processo_id)));

-- Membros só podem marcar eventos como lidos (update); inserção e remoção
-- ficam só com o service role (rota de verificação), por isso não há
-- policy de insert/delete pra authenticated.
drop policy if exists "eventos_processo_inpi_update_editor" on public.eventos_processo_inpi;
create policy "eventos_processo_inpi_update_editor" on public.eventos_processo_inpi
  for update to authenticated
  using (public.can_edit_workspace(public.workspace_of_processo_inpi(processo_id)))
  with check (public.can_edit_workspace(public.workspace_of_processo_inpi(processo_id)));
