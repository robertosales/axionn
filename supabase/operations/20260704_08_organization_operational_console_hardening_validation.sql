-- Axion SaaS - Fase 2B hardening validation.
-- Execute depois de aplicar manualmente as migrations 20260704080000 e 20260704080100.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260704:08_organization_operational_console_hardening')
);

do $$
declare
  v_missing text;
  v_tenancy_before boolean;
begin
  if to_regprocedure('public.is_tenancy_enforced()') is not null then
    execute 'select public.is_tenancy_enforced()' into v_tenancy_before;
    perform set_config(
      'axionn.operational_hardening.tenancy_before',
      coalesce(v_tenancy_before::text, 'null'),
      true
    );
  else
    perform set_config('axionn.operational_hardening.tenancy_before', 'absent', true);
  end if;

  select string_agg(object_name, ', ' order by object_name)
  into v_missing
  from (
    values
      ('teams.is_active', exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'teams' and column_name = 'is_active'
      )),
      ('get_organization_teams_admin_v2', to_regprocedure('public.get_organization_teams_admin_v2(uuid)') is not null),
      ('get_organization_contract_v2', to_regprocedure('public.get_organization_contract_v2(uuid,uuid)') is not null),
      ('get_organization_contract_form_options_v2', to_regprocedure('public.get_organization_contract_form_options_v2(uuid)') is not null),
      ('save_organization_contract_v3', to_regprocedure('public.save_organization_contract_v3(uuid,uuid,text,uuid,text,date,date,text,text,numeric,text,uuid[],uuid[])') is not null),
      ('create_organization_project_v2', to_regprocedure('public.create_organization_project_v2(uuid,uuid,uuid,text,text,text,text,bigint)') is not null),
      ('update_organization_project_v2', to_regprocedure('public.update_organization_project_v2(uuid,uuid,uuid,uuid,text,text,text,text,bigint)') is not null),
      ('archive_organization_project_v2', to_regprocedure('public.archive_organization_project_v2(uuid,uuid)') is not null),
      ('create_organization_team_v2', to_regprocedure('public.create_organization_team_v2(uuid,text,text,uuid,uuid)') is not null),
      ('update_organization_team_v2', to_regprocedure('public.update_organization_team_v2(uuid,uuid,text,text,uuid,uuid)') is not null),
      ('deactivate_organization_team_v2', to_regprocedure('public.deactivate_organization_team_v2(uuid,uuid)') is not null),
      ('list_platform_ai_providers_v2', to_regprocedure('public.list_platform_ai_providers_v2(boolean)') is not null),
      ('create_platform_ai_provider_v2', to_regprocedure('public.create_platform_ai_provider_v2(text,text,text,text,text,boolean,boolean)') is not null),
      ('update_platform_ai_provider_v2', to_regprocedure('public.update_platform_ai_provider_v2(uuid,text,text,text,text,text,boolean,boolean)') is not null),
      ('archive_platform_ai_provider_v2', to_regprocedure('public.archive_platform_ai_provider_v2(uuid)') is not null),
      ('set_platform_ai_provider_key_v2', to_regprocedure('public.set_platform_ai_provider_key_v2(uuid,text)') is not null)
  ) dependency(object_name, present)
  where not present;

  if v_missing is not null then
    raise exception 'Hardening incompleto. Dependencias ausentes: %', v_missing;
  end if;

  if has_function_privilege('anon', 'public.save_organization_contract_v3(uuid,uuid,text,uuid,text,date,date,text,text,numeric,text,uuid[],uuid[])', 'EXECUTE')
     or has_function_privilege('anon', 'public.create_organization_project_v2(uuid,uuid,uuid,text,text,text,text,bigint)', 'EXECUTE')
     or has_function_privilege('anon', 'public.create_organization_team_v2(uuid,text,text,uuid,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.list_platform_ai_providers_v2(boolean)', 'EXECUTE') then
    raise exception 'Hardening invalido: anon possui EXECUTE administrativo';
  end if;
end;
$$;

do $$
declare
  v_tenancy_before text := current_setting('axionn.operational_hardening.tenancy_before', true);
  v_tenancy_after boolean;
begin
  if v_tenancy_before <> 'absent' then
    execute 'select public.is_tenancy_enforced()' into v_tenancy_after;
    if v_tenancy_after::text is distinct from v_tenancy_before then
      raise exception 'Post-validation failed: tenancy_enforcement foi alterado';
    end if;
  end if;
end;
$$;

commit;

select
  to_regprocedure('public.save_organization_contract_v3(uuid,uuid,text,uuid,text,date,date,text,text,numeric,text,uuid[],uuid[])') is not null as contract_mutations_ready,
  to_regprocedure('public.create_organization_project_v2(uuid,uuid,uuid,text,text,text,text,bigint)') is not null as project_mutations_ready,
  to_regprocedure('public.create_organization_team_v2(uuid,text,text,uuid,uuid)') is not null as team_mutations_ready,
  to_regprocedure('public.list_platform_ai_providers_v2(boolean)') is not null as platform_ai_ready,
  (
    to_regprocedure('public.save_organization_contract_v3(uuid,uuid,text,uuid,text,date,date,text,text,numeric,text,uuid[],uuid[])') is not null
    and to_regprocedure('public.create_organization_project_v2(uuid,uuid,uuid,text,text,text,text,bigint)') is not null
    and to_regprocedure('public.create_organization_team_v2(uuid,text,text,uuid,uuid)') is not null
    and to_regprocedure('public.list_platform_ai_providers_v2(boolean)') is not null
  ) as organization_operational_console_hardening_ok;
