-- 0025_email_templates.sql
-- Modelo de e-mail customizável por workspace (aba Prospecção) — hoje só
-- um modelo por workspace ("prospeccao"), mas a coluna `chave` deixa
-- espaço pra outros tipos de modelo mais adiante sem redesenhar a tabela.
-- O envio em si não persiste nada (sem tabela de log): a rota
-- /api/emails/enviar-prospeccao lê o modelo já editado no cliente e manda
-- direto via Resend, mesmo padrão de src/lib/email.ts.

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  chave text not null default 'prospeccao',
  assunto text not null default '',
  corpo text not null default '',
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, chave)
);

create index if not exists idx_email_templates_workspace on public.email_templates (workspace_id);

alter table public.email_templates enable row level security;

drop policy if exists "email_templates_select_member" on public.email_templates;
create policy "email_templates_select_member" on public.email_templates
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "email_templates_cud_editor" on public.email_templates;
create policy "email_templates_cud_editor" on public.email_templates
  for all to authenticated
  using (public.can_edit_workspace(workspace_id))
  with check (public.can_edit_workspace(workspace_id));
