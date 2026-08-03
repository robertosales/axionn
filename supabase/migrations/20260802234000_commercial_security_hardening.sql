-- Harden tenant-owned notifications and private documents.
-- Storage reads are authorized through metadata rows already protected by RLS.

alter table public.notifications enable row level security;

drop policy if exists "Team members can insert notifications" on public.notifications;
create policy "Team members can insert notifications"
on public.notifications for insert to authenticated
with check (
  public.is_team_member(auth.uid(), team_id)
  and exists (
    select 1 from public.team_members recipient
    where recipient.team_id = notifications.team_id
      and recipient.user_id = notifications.user_id
  )
);

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
on public.notifications for delete to authenticated
using (auth.uid() = user_id);

alter table public.attachments enable row level security;

drop policy if exists "Member insert own team attachments" on public.attachments;
create policy "Member insert own team attachments"
on public.attachments for insert to authenticated
with check (
  auth.uid() = uploaded_by
  and public.is_team_member(auth.uid(), team_id)
  and (storage.foldername(file_path))[1] = auth.uid()::text
);

update storage.buckets set public = false where id = 'attachments';

drop policy if exists "Anyone can view attachments" on storage.objects;
drop policy if exists "Authenticated users can upload attachments" on storage.objects;
drop policy if exists "Users can delete own attachments" on storage.objects;
drop policy if exists "Tenant members can read attachment objects" on storage.objects;
drop policy if exists "Users can upload namespaced attachment objects" on storage.objects;
drop policy if exists "Users can delete own attachment objects" on storage.objects;

create policy "Tenant members can read attachment objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'attachments'
  and (
    exists (
      select 1 from public.attachments attachment
      where attachment.file_path = storage.objects.name
    )
    or exists (
      select 1 from public.demanda_evidencias evidence
      where evidence.file_path = storage.objects.name
    )
  )
);

create policy "Users can upload namespaced attachment objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own attachment objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

update storage.buckets set public = false where id = 'apf-documents';

drop policy if exists "apf-documents: authenticated upload" on storage.objects;
drop policy if exists "apf-documents: authenticated read" on storage.objects;
drop policy if exists "apf-documents: authenticated delete" on storage.objects;
drop policy if exists "Tenant members can read APF documents" on storage.objects;

create policy "Tenant members can read APF documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'apf-documents'
  and exists (
    select 1 from public.apf_generations generation
    where generation.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

-- APF documents are written only by trusted Edge Functions. service_role
-- bypasses RLS and needs no browser-facing insert, update, or delete policy.

revoke all on table public.notifications from anon;
revoke all on table public.attachments from anon;
revoke all on table public.demanda_evidencias from anon;

select pg_notify('pgrst', 'reload schema');
