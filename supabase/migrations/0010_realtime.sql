-- 0010_realtime.sql
-- Enables Supabase Realtime (postgres_changes) on the tables the Kanban
-- board and card modal need live sync for. RLS still applies to realtime
-- broadcasts (Supabase enforces the table's SELECT policy per-subscriber),
-- so this doesn't widen who can see what — it only makes existing reads live.
alter publication supabase_realtime add table public.board_columns;
alter publication supabase_realtime add table public.cards;
alter publication supabase_realtime add table public.comments;
