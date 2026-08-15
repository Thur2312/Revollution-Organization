-- 0018_crm_fechamento_celebrate.sql
-- The "Fechamento" stage is where a deal is won — celebrate it by default.
-- Re-seed the trigger so future CRM boards get it pre-enabled, and backfill
-- the Fechamento column on CRM boards that already exist.

create or replace function public.seed_crm_stages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'crm' then
    insert into public.board_columns (board_id, name, position, celebrate_on_card) values
      (new.id, 'Prospecção / geração de leads', 0, false),
      (new.id, 'Abordagem / primeira sondagem', 1, false),
      (new.id, 'Apresentação da solução', 2, false),
      (new.id, 'Acompanhamento (follow-up)', 3, false),
      (new.id, 'Negociação / condições', 4, false),
      (new.id, 'Fechamento', 5, true),
      (new.id, 'Pós-venda → indicação/fidelização', 6, false);
  end if;
  return new;
end;
$$;

update public.board_columns bc
set celebrate_on_card = true
from public.boards b
where b.id = bc.board_id
  and b.kind = 'crm'
  and bc.name = 'Fechamento';
