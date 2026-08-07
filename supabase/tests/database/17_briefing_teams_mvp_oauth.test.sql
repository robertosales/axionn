begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);

select has_table('public', 'meeting_oauth_states', 'meeting_oauth_states exists');
select ok(
  (select relrowsecurity from pg_class relation
   join pg_namespace namespace on namespace.oid = relation.relnamespace
   where namespace.nspname = 'public' and relation.relname = 'meeting_oauth_states'),
  'RLS enabled on OAuth states'
);
select ok(not has_table_privilege('authenticated', 'public.meeting_oauth_states', 'select'),
  'authenticated cannot read PKCE state metadata');

select ok(has_function_privilege('authenticated',
  'public.store_meeting_oauth_state_v1(uuid,uuid,text,text,text)', 'execute'),
  'authenticated admin may initiate PKCE through guarded RPC');
select ok(not has_function_privilege('authenticated',
  'public.consume_meeting_oauth_state_v1(text,uuid)', 'execute'),
  'browser cannot consume PKCE verifier');
select ok(has_function_privilege('service_role',
  'public.consume_meeting_oauth_state_v1(text,uuid)', 'execute'),
  'connector backend may consume PKCE verifier');
select ok(not has_function_privilege('authenticated',
  'public.upsert_teams_meeting_connection_v1(uuid,uuid,text,text,text,text[],text)', 'execute'),
  'browser cannot persist OAuth tokens');
select ok(has_function_privilege('service_role',
  'public.upsert_teams_meeting_connection_v1(uuid,uuid,text,text,text,text[],text)', 'execute'),
  'connector backend may persist OAuth tokens');
select ok(not has_function_privilege('authenticated',
  'public.get_meeting_connection_secret_v1(uuid)', 'execute'),
  'browser cannot decrypt connection token');
select ok(has_function_privilege('service_role',
  'public.get_meeting_connection_secret_v1(uuid)', 'execute'),
  'connector backend may retrieve connection token');
select ok(not has_function_privilege('authenticated',
  'public.update_meeting_connection_secret_v1(uuid,text,text[])', 'execute'),
  'browser cannot rotate connection token');
select ok(has_function_privilege('service_role',
  'public.update_meeting_connection_secret_v1(uuid,text,text[])', 'execute'),
  'connector backend may rotate connection token');

select ok(
  exists (
    select 1 from pg_constraint constraint_record
    where constraint_record.conname = 'ai_briefings_source_type_check'
      and pg_get_constraintdef(constraint_record.oid) like '%meeting_transcript%'
  ),
  'ai_briefings accepts meeting transcript source'
);

select * from finish();
rollback;
