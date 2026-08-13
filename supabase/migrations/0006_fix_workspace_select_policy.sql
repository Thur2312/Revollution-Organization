-- 0006_fix_workspace_select_policy.sql
--
-- `INSERT ... RETURNING` on a table with RLS also enforces that table's
-- SELECT policy against the newly-inserted row (documented Postgres RLS
-- behavior, not Supabase-specific). `workspaces_select_member` alone can't
-- be satisfied right after creating a workspace: the membership row that
-- makes the creator "a member" is only inserted by the AFTER INSERT
-- trigger `handle_new_workspace`, so `insert(...).select()` on `workspaces`
-- fails with "new row violates row-level security policy" even though the
-- INSERT's own `with check (owner_id = auth.uid())` is satisfied.
--
-- The current frontend (WorkspaceList.tsx) avoids this by never chaining
-- `.select()` after the workspace insert, but that's a landmine for any
-- future caller that does. Fix: let the owner see their own workspace row
-- directly, independent of the membership row's existence/timing.

drop policy "workspaces_select_member" on public.workspaces;

create policy "workspaces_select_member" on public.workspaces
  for select to authenticated
  using (public.is_workspace_member(id) or owner_id = auth.uid());
