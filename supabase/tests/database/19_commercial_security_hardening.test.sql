begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'notifications'),
  'notifications has RLS enabled'
);

select policies_are('public', 'notifications', array[
  'Admins full access notifications',
  'Team members can insert notifications',
  'Users can delete own notifications',
  'Users can update own notifications',
  'Users can view own notifications'
]);

select ok((select not public from storage.buckets where id = 'attachments'),
  'attachments bucket is private');
select ok((select not public from storage.buckets where id = 'apf-documents'),
  'APF documents bucket is private');

select ok(
  not exists (select 1 from pg_policies where schemaname = 'storage'
    and tablename = 'objects' and policyname = 'Anyone can view attachments'),
  'anonymous attachment read policy was removed'
);

select ok(
  exists (select 1 from pg_policies where schemaname = 'storage'
    and tablename = 'objects' and policyname = 'Tenant members can read attachment objects'
    and roles = array['authenticated'::name]),
  'attachment reads require an authenticated tenant member'
);

select ok(
  exists (select 1 from pg_policies where schemaname = 'storage'
    and tablename = 'objects' and policyname = 'Tenant members can read APF documents'
    and roles = array['authenticated'::name]),
  'APF document reads require an authenticated tenant member'
);

select ok(not has_table_privilege('anon', 'public.notifications', 'select'),
  'anon cannot select notifications');
select ok(not has_table_privilege('anon', 'public.attachments', 'select'),
  'anon cannot select attachment metadata');
select ok(not has_table_privilege('anon', 'public.demanda_evidencias', 'select'),
  'anon cannot select evidence metadata');

select is((select file_size_limit from storage.buckets where id = 'attachments'),
  20971520::bigint, 'attachment size is enforced by Storage');
select ok(
  not ('text/html' = any((select allowed_mime_types from storage.buckets where id = 'attachments')))
  and not ('image/svg+xml' = any((select allowed_mime_types from storage.buckets where id = 'attachments'))),
  'active web content is rejected by the attachment bucket'
);

select * from finish();
rollback;
