-- 0009_notifications.sql
-- In-app activity notifications: "you were assigned to a card" and
-- "someone commented on your card". Populated by triggers (never written
-- directly by the client) so there's no way to forge a notification as
-- another user or spam-insert rows via the API.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('card_assigned', 'card_commented')),
  card_id uuid references public.cards (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Read-only from the client's perspective except read_at (marking as read);
-- inserts only ever happen via the SECURITY DEFINER trigger functions below.
create policy "notifications_select_own" on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Fires whenever a card's metadata changes (assignee_ids lives inside the
-- jsonb blob, so we compare old vs new arrays rather than a dedicated
-- column). Only the newly-added assignees get notified — re-saving
-- metadata with the same assignees, or removing one, is silent.
create or replace function public.notify_card_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_assignees uuid[];
  new_assignees uuid[];
  newly_added uuid;
begin
  select coalesce(array_agg(x::uuid), '{}')
    into old_assignees
    from jsonb_array_elements_text(coalesce(old.metadata -> 'assignee_ids', '[]'::jsonb)) x;

  select coalesce(array_agg(x::uuid), '{}')
    into new_assignees
    from jsonb_array_elements_text(coalesce(new.metadata -> 'assignee_ids', '[]'::jsonb)) x;

  foreach newly_added in array new_assignees loop
    if not (newly_added = any(old_assignees)) and newly_added <> auth.uid() then
      insert into public.notifications (user_id, type, card_id, actor_id)
      values (newly_added, 'card_assigned', new.id, auth.uid());
    end if;
  end loop;

  return new;
end;
$$;

create trigger on_card_updated_notify_assignment
  after update of metadata on public.cards
  for each row execute function public.notify_card_assigned();

-- Notifies the card's creator and current assignees about a new comment,
-- skipping the commenter themselves (and de-duping creator vs assignee via
-- the `<> coalesce` guards so the same person doesn't get two rows).
create or replace function public.notify_card_commented()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  card_row record;
  assignee uuid;
begin
  select metadata, created_by into card_row from public.cards where id = new.card_id;

  if card_row.created_by is not null and card_row.created_by <> new.user_id then
    insert into public.notifications (user_id, type, card_id, actor_id)
    values (card_row.created_by, 'card_commented', new.card_id, new.user_id);
  end if;

  for assignee in
    select x::uuid from jsonb_array_elements_text(coalesce(card_row.metadata -> 'assignee_ids', '[]'::jsonb)) x
  loop
    if assignee <> new.user_id and assignee <> coalesce(card_row.created_by, '00000000-0000-0000-0000-000000000000'::uuid) then
      insert into public.notifications (user_id, type, card_id, actor_id)
      values (assignee, 'card_commented', new.card_id, new.user_id);
    end if;
  end loop;

  return new;
end;
$$;

create trigger on_comment_created_notify
  after insert on public.comments
  for each row execute function public.notify_card_commented();
