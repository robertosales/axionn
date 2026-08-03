-- Read-only deployed-catalog security audit. Run through Lovable in staging,
-- then production. Every returned row requires review; this script changes no data.

-- 1. Public tables without RLS.
select 'TABLE_WITHOUT_RLS' as finding, namespace.nspname as schema_name,
       relation.relname as object_name, null::text as detail
from pg_class relation
join pg_namespace namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relkind in ('r', 'p')
  and not relation.relrowsecurity

union all

-- 2. Anonymous privileges on application tables.
select 'ANON_TABLE_PRIVILEGE', privilege.table_schema, privilege.table_name,
       privilege.privilege_type
from information_schema.role_table_grants privilege
where privilege.grantee = 'anon'
  and privilege.table_schema in ('public', 'storage')

union all

-- 3. SECURITY DEFINER functions executable by PUBLIC or anon.
select 'EXPOSED_SECURITY_DEFINER', namespace.nspname,
       procedure.proname,
       pg_get_function_identity_arguments(procedure.oid)
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.prosecdef
  and exists (
    select 1
    from aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) grant_info
    where grant_info.privilege_type = 'EXECUTE'
      and grant_info.grantee in (
        0,
        coalesce((select role.oid from pg_roles role where role.rolname = 'anon'), 0)
      )
  )

union all

-- 4. SECURITY DEFINER functions without a pinned search_path.
select 'UNPINNED_SECURITY_DEFINER', namespace.nspname,
       procedure.proname,
       pg_get_function_identity_arguments(procedure.oid)
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.prosecdef
  and not exists (
    select 1 from unnest(coalesce(procedure.proconfig, array[]::text[])) setting
    where setting like 'search_path=%'
  )

union all

-- 5. Views that execute with the owner's privileges.
select 'NON_INVOKER_VIEW', view_info.schemaname, view_info.viewname,
       'security_invoker is not enabled'
from pg_views view_info
where view_info.schemaname = 'public'
  and not exists (
    select 1 from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = view_info.schemaname
      and relation.relname = view_info.viewname
      and coalesce(relation.reloptions, array[]::text[]) @> array['security_invoker=true']
  )

union all

-- 6. Public Storage buckets.
select 'PUBLIC_STORAGE_BUCKET', 'storage', bucket.id, bucket.name
from storage.buckets bucket
where bucket.public

order by finding, schema_name, object_name;
