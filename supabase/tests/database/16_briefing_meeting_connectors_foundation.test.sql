begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(27);

select has_table('public', 'meeting_connections', 'meeting_connections exists');
select has_table('public', 'meeting_sync_cursors', 'meeting_sync_cursors exists');
select has_table('public', 'meeting_webhook_events', 'meeting_webhook_events exists');
select has_table('public', 'external_meetings', 'external_meetings exists');
select has_table('public', 'meeting_participants', 'meeting_participants exists');
select has_table('public', 'meeting_artifacts', 'meeting_artifacts exists');
select has_table('public', 'meeting_transcript_segments', 'meeting_transcript_segments exists');
select has_table('public', 'meeting_processing_jobs', 'meeting_processing_jobs exists');
select has_table('public', 'briefing_source_links', 'briefing_source_links exists');
select has_table('public', 'meeting_audit_events', 'meeting_audit_events exists');

select is(
  (select count(*)::integer from pg_class relation
   join pg_namespace namespace on namespace.oid = relation.relnamespace
   where namespace.nspname = 'public'
     and relation.relname in (
       'meeting_connections', 'meeting_sync_cursors', 'meeting_webhook_events',
       'external_meetings', 'meeting_participants', 'meeting_artifacts',
       'meeting_transcript_segments', 'meeting_processing_jobs',
       'briefing_source_links', 'meeting_audit_events'
     ) and relation.relrowsecurity),
  10,
  'RLS enabled on every meeting connector table'
);

select ok(not has_table_privilege('anon', 'public.external_meetings', 'select'),
  'anon cannot read meetings');
select ok(not has_table_privilege('authenticated', 'public.external_meetings', 'insert'),
  'authenticated cannot insert meetings directly');
select ok(not has_table_privilege('authenticated', 'public.meeting_connections', 'update'),
  'authenticated cannot update connections directly');
select ok(not has_table_privilege('authenticated', 'public.meeting_connections', 'select'),
  'authenticated cannot read secret references from the connection table');

select ok(has_function_privilege('authenticated',
  'public.request_meeting_import_v1(uuid,uuid,uuid,uuid,text)', 'execute'),
  'authenticated may request import through hardened RPC');
select ok(not has_function_privilege('anon',
  'public.request_meeting_import_v1(uuid,uuid,uuid,uuid,text)', 'execute'),
  'anon cannot request import');
select ok(has_function_privilege('authenticated',
  'public.list_meeting_connections_v1(uuid)', 'execute'),
  'authenticated reads sanitized connections through RPC');

select has_trigger('public', 'external_meetings', 'trg_external_meeting_state',
  'meeting state monotonicity trigger exists');
select has_trigger('public', 'external_meetings', 'trg_external_meeting_context',
  'meeting organizational context trigger exists');

select ok(has_function_privilege('service_role',
  'public.receive_meeting_webhook_event_v1(uuid,text,text,text,text,timestamptz,uuid)', 'execute'),
  'service role may receive webhook events');
select ok(not has_function_privilege('authenticated',
  'public.receive_meeting_webhook_event_v1(uuid,text,text,text,text,timestamptz,uuid)', 'execute'),
  'authenticated cannot write webhook inbox');
select ok(has_function_privilege('service_role',
  'public.claim_meeting_processing_jobs_v1(text,integer)', 'execute'),
  'service role may claim jobs');
select ok(not has_function_privilege('authenticated',
  'public.claim_meeting_processing_jobs_v1(text,integer)', 'execute'),
  'authenticated cannot claim internal jobs');
select ok(not has_function_privilege('authenticated',
  'public.fail_meeting_processing_job_v1(uuid,text,text,text,boolean)', 'execute'),
  'authenticated cannot mutate retry and dead-letter state');

select is((select count(*)::integer from public.app_permissions where group_key = 'briefing'),
  9, 'nine briefing permissions are registered');

select ok(not exists(
  select 1 from public.saas_plan_entitlements entitlement
  where entitlement.feature_key = 'briefing.integrations.enabled' and entitlement.enabled
), 'meeting integrations remain disabled by default');

select * from finish();
rollback;
