-- 0027_comment_attachments.sql
-- Lets a photo be attached directly to a comment, not just to the card in
-- general. Keeps card_id populated as before (so the existing
-- attachments_storage_*/attachments_* RLS policies, all scoped by
-- workspace_of_card(card_id), keep working unchanged) and adds an
-- optional comment_id just to tag which comment a given attachment
-- belongs to, for grouping it under that comment in the UI.

alter table public.attachments add column comment_id uuid references public.comments (id) on delete cascade;

create index idx_attachments_comment on public.attachments (comment_id);
