-- 0014_card_activity.sql
-- Per-card audit trail: who created it, moved it, renamed it, or changed
-- its priority/due date/assignees. Populated entirely by triggers (never
-- written directly by the client), same trust model as notifications.
-- Position-only updates (drag reorder within a column) touch neither
-- column_id, title, nor metadata, so they're silent — only real changes
-- get logged.

create table public.card_activity (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (
    action in ('created', 'moved', 'renamed', 'priority_changed', 'due_date_changed', 'assignee_added', 'assignee_removed')
  ),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_card_activity_card on public.card_activity (card_id, created_at desc);

alter table public.card_activity enable row level security;

create policy "card_activity_select_member" on public.card_activity
  for select to authenticated using (public.is_workspace_member(public.workspace_of_card(card_id)));

create or replace function public.log_card_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.card_activity (card_id, actor_id, action, detail)
  values (new.id, coalesce(new.created_by, auth.uid()), 'created', jsonb_build_object('title', new.title));
  return new;
end;
$$;

create trigger on_card_created_log
  after insert on public.cards
  for each row execute function public.log_card_created();

create or replace function public.log_card_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_col_name text;
  new_col_name text;
  old_assignees uuid[];
  new_assignees uuid[];
  changed_id uuid;
begin
  if new.column_id <> old.column_id then
    select name into old_col_name from public.board_columns where id = old.column_id;
    select name into new_col_name from public.board_columns where id = new.column_id;
    insert into public.card_activity (card_id, actor_id, action, detail)
    values (new.id, auth.uid(), 'moved', jsonb_build_object('from', old_col_name, 'to', new_col_name));
  end if;

  if new.title <> old.title then
    insert into public.card_activity (card_id, actor_id, action, detail)
    values (new.id, auth.uid(), 'renamed', jsonb_build_object('from', old.title, 'to', new.title));
  end if;

  if coalesce(new.metadata ->> 'priority', '') <> coalesce(old.metadata ->> 'priority', '') then
    insert into public.card_activity (card_id, actor_id, action, detail)
    values (
      new.id, auth.uid(), 'priority_changed',
      jsonb_build_object('from', old.metadata ->> 'priority', 'to', new.metadata ->> 'priority')
    );
  end if;

  if coalesce(new.metadata ->> 'due_date', '') <> coalesce(old.metadata ->> 'due_date', '') then
    insert into public.card_activity (card_id, actor_id, action, detail)
    values (
      new.id, auth.uid(), 'due_date_changed',
      jsonb_build_object('from', old.metadata ->> 'due_date', 'to', new.metadata ->> 'due_date')
    );
  end if;

  select coalesce(array_agg(x::uuid), '{}')
    into old_assignees
    from jsonb_array_elements_text(coalesce(old.metadata -> 'assignee_ids', '[]'::jsonb)) x;
  select coalesce(array_agg(x::uuid), '{}')
    into new_assignees
    from jsonb_array_elements_text(coalesce(new.metadata -> 'assignee_ids', '[]'::jsonb)) x;

  foreach changed_id in array new_assignees loop
    if not (changed_id = any(old_assignees)) then
      insert into public.card_activity (card_id, actor_id, action, detail)
      values (new.id, auth.uid(), 'assignee_added', jsonb_build_object('user_id', changed_id));
    end if;
  end loop;

  foreach changed_id in array old_assignees loop
    if not (changed_id = any(new_assignees)) then
      insert into public.card_activity (card_id, actor_id, action, detail)
      values (new.id, auth.uid(), 'assignee_removed', jsonb_build_object('user_id', changed_id));
    end if;
  end loop;

  return new;
end;
$$;

create trigger on_card_updated_log
  after update on public.cards
  for each row execute function public.log_card_updated();
