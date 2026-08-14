-- 0008_before_user_created_hook.sql
-- Hard enforcement of "signup is invite-link only" at the Supabase Auth
-- level, closing the gap left by the 0007 RPC (which only gates the app's
-- own frontend — a direct call to the Auth REST API could still bypass it).
-- This function is wired up as the project's "before user created" Auth
-- Hook (enabled separately via the Management API, not in this migration —
-- hook wiring is project config, not schema). Once enabled, GoTrue calls
-- this function synchronously before inserting into auth.users and denies
-- the signup if it returns an error object.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  v_email := lower(trim(event->'user'->>'email'));

  if v_email is null or not exists (
    select 1 from public.workspace_invites
    where lower(email) = v_email and accepted_at is null
  ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Este email ainda não foi convidado para a Revollution.',
        'http_code', 403
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

-- Only the Auth service (supabase_auth_admin) may call this — it must not
-- be reachable through PostgREST/RPC by anon or authenticated callers.
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from authenticated, anon, public;
