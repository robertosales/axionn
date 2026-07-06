-- Axion SaaS - Fase 2A / Lote 6
-- Rollback manual: religa somente o fallback legado organizacional.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260704:06_enable_legacy_permission_fallback_rollback')
);

do $$
declare
  v_missing text;
begin
  select string_agg(object_name, ', ' order by object_name)
  into v_missing
  from (
    values
      ('public.saas_runtime_settings', to_regclass('public.saas_runtime_settings') is not null),
      ('public.is_organization_legacy_permission_fallback_enabled()', to_regprocedure('public.is_organization_legacy_permission_fallback_enabled()') is not null),
      ('public.set_organization_legacy_permission_fallback(boolean)', to_regprocedure('public.set_organization_legacy_permission_fallback(boolean)') is not null)
  ) dependency(object_name, present)
  where not present;

  if v_missing is not null then
    raise exception 'Dependencias ausentes para rollback Lote 6: %', v_missing;
  end if;

  if has_function_privilege('anon', 'public.set_organization_legacy_permission_fallback(boolean)', 'EXECUTE') then
    raise exception 'Rollback bloqueado: anon pode alterar fallback legado.';
  end if;
end;
$$;

select public.set_organization_legacy_permission_fallback(true);

do $$
begin
  if not public.is_organization_legacy_permission_fallback_enabled() then
    raise exception 'Post-rollback validation failed: fallback legado nao foi religado.';
  end if;
end;
$$;

commit;

select
  public.is_organization_legacy_permission_fallback_enabled() as fallback_enabled,
  public.is_organization_legacy_permission_fallback_enabled() as legacy_permission_rollback_ok;
