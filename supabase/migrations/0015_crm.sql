-- 0015_crm.sql
-- CRM is a specialised board: boards.kind distinguishes it from the generic
-- project-management boards, and a trigger auto-seeds the fixed sales-funnel
-- stages (as board_columns) the moment a CRM board is created — the funnel
-- shape is fixed for now (see docs discussion), not user-editable.

alter table public.boards
  add column kind text not null default 'kanban'
  check (kind in ('kanban', 'crm'));

-- One CRM board per workspace.
create unique index idx_boards_one_crm_per_workspace
  on public.boards (workspace_id)
  where kind = 'crm';

create or replace function public.seed_crm_stages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'crm' then
    insert into public.board_columns (board_id, name, position) values
      (new.id, 'Prospecção / geração de leads', 0),
      (new.id, 'Abordagem / primeira sondagem', 1),
      (new.id, 'Apresentação da solução', 2),
      (new.id, 'Acompanhamento (follow-up)', 3),
      (new.id, 'Negociação / condições', 4),
      (new.id, 'Fechamento', 5),
      (new.id, 'Pós-venda → indicação/fidelização', 6);
  end if;
  return new;
end;
$$;

create trigger on_crm_board_created
  after insert on public.boards
  for each row execute function public.seed_crm_stages();
