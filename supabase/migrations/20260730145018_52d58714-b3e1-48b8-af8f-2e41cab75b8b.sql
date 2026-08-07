drop policy if exists "attachments_owner_select" on storage.objects;
create policy "attachments_owner_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'attachments'
  and auth.uid()::text = (storage.foldername(name))[1]
);