-- 0013_mentions.sql
-- @mentions in comments: typing "@Full Name" in a comment notifies that
-- specific workspace member, even if they're not the card's creator or an
-- assignee. Detection happens inside the same notify_card_commented()
-- trigger (matching against workspace members' full_name), not client-side,
-- so it can't be spoofed and doesn't need a separate write path.

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('card_assigned', 'card_commented', 'card_mentioned'));

create or replace function public.notify_card_commented()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  card_row record;
  ws_id uuid;
  assignee uuid;
  mentioned_id uuid;
  already_notified uuid[] := '{}';
begin
  select metadata, created_by into card_row from public.cards where id = new.card_id;
  ws_id := public.workspace_of_card(new.card_id);

  if card_row.created_by is not null and card_row.created_by <> new.user_id then
    insert into public.notifications (user_id, type, card_id, actor_id)
    values (card_row.created_by, 'card_commented', new.card_id, new.user_id);
    already_notified := already_notified || card_row.created_by;
  end if;

  for assignee in
    select x::uuid from jsonb_array_elements_text(coalesce(card_row.metadata -> 'assignee_ids', '[]'::jsonb)) x
  loop
    if assignee <> new.user_id and not (assignee = any(already_notified)) then
      insert into public.notifications (user_id, type, card_id, actor_id)
      values (assignee, 'card_commented', new.card_id, new.user_id);
      already_notified := already_notified || assignee;
    end if;
  end loop;

  for mentioned_id in
    select m.user_id
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.workspace_id = ws_id
      and p.full_name is not null
      and new.text ilike '%@' || p.full_name || '%'
      and m.user_id <> new.user_id
  loop
    if not (mentioned_id = any(already_notified)) then
      insert into public.notifications (user_id, type, card_id, actor_id)
      values (mentioned_id, 'card_mentioned', new.card_id, new.user_id);
      already_notified := already_notified || mentioned_id;
    end if;
  end loop;

  return new;
end;
$$;
