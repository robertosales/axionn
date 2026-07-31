-- Validação cumulativa, somente leitura, da gestão RBAC de membros.
-- Executar após 20260730210000_organization_member_rbac_management.sql.

do $$
begin
  if to_regprocedure(
    'public.manage_organization_member_v1(uuid,uuid,text,text,boolean,text[])'
  ) is null then
    raise exception 'manage_organization_member_v1_not_installed';
  end if;

  if has_function_privilege(
    'anon',
    'public.manage_organization_member_v1(uuid,uuid,text,text,boolean,text[])',
    'execute'
  ) then
    raise exception 'anon_can_manage_organization_members';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.manage_organization_member_v1(uuid,uuid,text,text,boolean,text[])',
    'execute'
  ) then
    raise exception 'authenticated_missing_manage_member_grant';
  end if;

  if not exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'manage_organization_member_v1'
      and procedure.prosecdef
      and procedure.proconfig @> array['search_path=public, pg_temp']
  ) then
    raise exception 'manage_member_security_boundary_invalid';
  end if;
end;
$$;

select
  to_regprocedure(
    'public.manage_organization_member_v1(uuid,uuid,text,text,boolean,text[])'
  ) is not null
  and not has_function_privilege(
    'anon',
    'public.manage_organization_member_v1(uuid,uuid,text,text,boolean,text[])',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.manage_organization_member_v1(uuid,uuid,text,text,boolean,text[])',
    'execute'
  )
  as organization_member_rbac_validation_ok;
