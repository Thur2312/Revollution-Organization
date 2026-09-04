-- 0021_processos_inpi.sql
-- Acompanhamento de processos do INPI (marca, patente, desenho industrial),
-- copiado do produto Lastro: uma tabela de estado atual (processos_inpi) +
-- uma tabela de eventos append-only (eventos_processo_inpi). Diferente do
-- Lastro (pessoal, dono = auth.uid()), aqui o dono é o workspace, então
-- segue o mesmo padrão de RLS de boards/cards (is_workspace_member /
-- can_edit_workspace) em vez de RPCs security-definer pra escrita — este
-- app não tem limites de plano por processo, então não precisa da
-- indireção extra que o Lastro usa pra checar isso.
--
-- Fonte dos dados: não existe API oficial do INPI. src/lib/inpi/cliente.ts
-- consulta o portal público de busca (pePI, busca.inpi.gov.br) de forma
-- anônima, sem chave de API.

create table public.processos_inpi (
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
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (workspace_id, numero_processo, tipo)
);

-- Append-only: nunca editado, só inserido pelo job de verificação
-- (service role) e lido pelos membros do workspace.
create table public.eventos_processo_inpi (
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

create index idx_processos_inpi_workspace on public.processos_inpi (workspace_id);
create index idx_processos_inpi_ativo on public.processos_inpi (ativo);
create index idx_eventos_processo_inpi_processo on public.eventos_processo_inpi (processo_id, encontrado_em desc);

alter table public.processos_inpi enable row level security;
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

create policy "processos_inpi_select_member" on public.processos_inpi
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "processos_inpi_cud_editor" on public.processos_inpi
  for all to authenticated
  using (public.can_edit_workspace(workspace_id))
  with check (public.can_edit_workspace(workspace_id));

create policy "eventos_processo_inpi_select_member" on public.eventos_processo_inpi
  for select to authenticated
  using (public.is_workspace_member(public.workspace_of_processo_inpi(processo_id)));

-- Membros só podem marcar como lido (update), nunca inserir/apagar
-- diretamente — eventos só nascem via service role (rota de verificação).
create policy "eventos_processo_inpi_update_editor" on public.eventos_processo_inpi
  for update to authenticated
  using (public.can_edit_workspace(public.workspace_of_processo_inpi(processo_id)))
  with check (public.can_edit_workspace(public.workspace_of_processo_inpi(processo_id)));
