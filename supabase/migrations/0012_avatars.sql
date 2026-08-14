-- 0012_avatars.sql
-- Public 'avatars' bucket (unlike 'attachments', avatars need to render
-- anywhere in the UI — card assignee chips, member lists — without paying
-- for a signed-URL round trip per render). Objects are keyed as
-- {user_id}/avatar.{ext} with upsert:true on write, so re-uploading
-- replaces the same object instead of accumulating orphans.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_storage_select" on storage.objects
  for select
  using (bucket_id = 'avatars');

create policy "avatars_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_storage_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_storage_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- search_users_by_email() needs to also return avatar_url now that the
-- MembersPanel search dropdown shows a person's real photo. Postgres won't
-- let CREATE OR REPLACE change a `returns table(...)` shape, so drop first.
drop function if exists public.search_users_by_email(text);

create function public.search_users_by_email(p_query text)
returns table (id uuid, email text, full_name text, avatar_url text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.email, p.full_name, p.avatar_url
  from public.profiles p
  where length(trim(p_query)) >= 3
    and lower(p.email) like lower(trim(p_query)) || '%'
    and p.id <> auth.uid()
  order by p.email
  limit 8;
$$;
