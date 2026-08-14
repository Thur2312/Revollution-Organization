-- 0007_signup_gate.sql
-- Product decision: signup is invite-link only, not open self-service.
-- The signin page still has to call supabase.auth.signUp() itself (there's
-- no separate "accept invite" flow yet), so the gate lives in a boolean-only
-- RPC the frontend checks before calling signUp. It deliberately reveals
-- nothing beyond yes/no for a given email — not which workspace, not who
-- invited them — so it's safe to expose to anon.
--
-- Note this is a UX/product gate, not a hard security boundary: a caller
-- hitting Supabase Auth's REST API directly (bypassing this app's frontend)
-- could still create an auth user. That account would just end up with zero
-- memberships and zero workspaces (handle_new_workspace only fires when a
-- workspace is created, not on signup), same as any other unauthorized
-- signup today. A hard block would need a Supabase Auth Hook configured at
-- the project level, out of scope for this pass.
create or replace function public.email_has_pending_invite(p_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_invites
    where lower(email) = lower(trim(p_email)) and accepted_at is null
  );
$$;

grant execute on function public.email_has_pending_invite(text) to anon, authenticated;
