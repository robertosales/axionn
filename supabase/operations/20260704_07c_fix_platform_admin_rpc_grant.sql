-- Axion SaaS - Fase 2B / Hotfix
-- Restaura o grant minimo para leitura do status platform_admin pelo frontend.
-- Nao altera roles, memberships ou dados.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260704:07c_fix_platform_admin_rpc_grant')
);

do $$
begin
  if to_regprocedure('public.is_platform_admin(uuid)') is null then
    raise exception 'Dependencia ausente: public.is_platform_admin(uuid)';
  end if;
end;
$$;

revoke all on function public.is_platform_admin(uuid)
  from public, anon;
grant execute on function public.is_platform_admin(uuid)
  to authenticated, service_role;

do $$
begin
  if not has_function_privilege(
    'authenticated',
    'public.is_platform_admin(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Post-validation failed: authenticated sem execute em is_platform_admin';
  end if;

  if has_function_privilege(
    'anon',
    'public.is_platform_admin(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Post-validation failed: anon pode executar is_platform_admin';
  end if;
end;
$$;

commit;

select
  to_regprocedure('public.is_platform_admin(uuid)') is not null
    as platform_admin_rpc_present,
  has_function_privilege(
    'authenticated',
    'public.is_platform_admin(uuid)',
    'EXECUTE'
  ) as authenticated_platform_admin_rpc_available,
  not has_function_privilege(
    'anon',
    'public.is_platform_admin(uuid)',
    'EXECUTE'
  ) as anonymous_platform_admin_rpc_revoked,
  (
    to_regprocedure('public.is_platform_admin(uuid)') is not null
    and has_function_privilege(
      'authenticated',
      'public.is_platform_admin(uuid)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.is_platform_admin(uuid)',
      'EXECUTE'
    )
  ) as platform_admin_rpc_grant_hotfix_ok;
