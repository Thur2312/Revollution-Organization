-- 0004_storage.sql
-- Private 'attachments' bucket. Objects are keyed as
-- {workspace_id}/{card_id}/{file_name} so RLS can check membership straight
-- from the object path via storage.foldername(name)[1] = workspace_id.
-- The frontend must upload/read through signed URLs (createSignedUrl /
-- createSignedUploadUrl), never by making the bucket public.

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "attachments_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "attachments_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "attachments_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (
      owner = auth.uid()
      or public.is_workspace_admin((storage.foldername(name))[1]::uuid)
    )
  );
