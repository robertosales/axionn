-- Deny-by-default for future RPCs created by the migration owner.
-- Every browser-callable function must receive an explicit authenticated grant.
alter default privileges in schema public
  revoke execute on functions from public;
alter default privileges in schema public
  revoke execute on functions from anon;

-- Enforce upload controls at Storage, not only in the bypassable frontend.
update storage.buckets
set public = false,
    file_size_limit = 20971520,
    allowed_mime_types = array[
      'application/pdf',
      'application/zip',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/plain',
      'text/csv',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp'
    ]::text[]
where id = 'attachments';

-- Internal trigger/worker functions must never be callable through PostgREST.
do $$
declare
  function_record record;
begin
  for function_record in
    select procedure.oid::regprocedure as signature
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and procedure.prorettype = 'trigger'::regtype
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      function_record.signature
    );
  end loop;
end;
$$;

select pg_notify('pgrst', 'reload schema');
