-- Axion SaaS - Fase 2A / Lote 6
-- Hotfix operacional: permite que o SQL Editor administrativo altere o fallback legado.
-- Execute antes de repetir 20260704_06_disable_legacy_permission_fallback.sql
-- se o erro for organization_legacy_permission_fallback_toggle_denied.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260704:06_fix_legacy_permission_fallback_toggle')
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
      ('public.platform_user_roles', to_regclass('public.platform_user_roles') is not null),
      ('public.is_platform_admin(uuid)', to_regprocedure('public.is_platform_admin(uuid)') is not null)
  ) dependency(object_name, present)
  where not present;

  if v_missing is not null then
    raise exception 'Dependencias ausentes para hotfix Lote 6: %', v_missing;
  end if;
end;
$$;

create or replace function public.set_organization_legacy_permission_fallback(
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not coalesce(public.is_platform_admin(auth.uid()), false)
     and not (
       auth.uid() is null
       and nullif(current_setting('request.jwt.claim.role', true), '') is null
       and session_user in ('postgres', 'supabase_admin')
     ) then
    raise exception using
      errcode = '42501',
      message = 'organization_legacy_permission_fallback_toggle_denied';
  end if;

  insert into public.saas_runtime_settings (key, value, updated_at, updated_by)
  values (
    'organization_legacy_permission_fallback_enabled',
    jsonb_build_object('enabled', p_enabled),
    now(),
    auth.uid()
  )
  on conflict (key) do update
    set value = excluded.value,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.set_organization_legacy_permission_fallback(boolean)
  from public, anon;
grant execute on function public.set_organization_legacy_permission_fallback(boolean)
  to authenticated, service_role;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.set_organization_legacy_permission_fallback(boolean)',
    'EXECUTE'
  ) then
    raise exception 'Post-validation failed: anon pode alterar fallback legado.';
  end if;

  if to_regprocedure('public.set_organization_legacy_permission_fallback(boolean)') is null then
    raise exception 'Post-validation failed: funcao de toggle ausente.';
  end if;
end;
$$;

commit;

select
  to_regprocedure('public.set_organization_legacy_permission_fallback(boolean)') is not null
    as fallback_toggle_function_ready,
  not has_function_privilege(
    'anon',
    'public.set_organization_legacy_permission_fallback(boolean)',
    'EXECUTE'
  ) as anonymous_toggle_revoked,
  (
    to_regprocedure('public.set_organization_legacy_permission_fallback(boolean)') is not null
    and not has_function_privilege(
      'anon',
      'public.set_organization_legacy_permission_fallback(boolean)',
      'EXECUTE'
    )
  ) as legacy_permission_toggle_hotfix_ok;
