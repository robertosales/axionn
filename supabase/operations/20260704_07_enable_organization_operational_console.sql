-- Axion SaaS - Fase 2B / Lote 8
-- Ativa somente o console operacional da organizacao. Preserva o fallback.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260704:07_enable_organization_operational_console')
);

do $$
declare
  v_missing text;
  v_blockers bigint;
begin
  select string_agg(object_name, ', ' order by object_name)
  into v_missing
  from (
    values
      ('public.is_organization_operational_console_enabled()', to_regprocedure('public.is_organization_operational_console_enabled()') is not null),
      ('public.set_organization_operational_console(boolean)', to_regprocedure('public.set_organization_operational_console(boolean)') is not null),
      ('public.is_legacy_operational_admin_fallback_enabled()', to_regprocedure('public.is_legacy_operational_admin_fallback_enabled()') is not null),
      ('public.organization_operational_audit_log', to_regclass('public.organization_operational_audit_log') is not null)
  ) dependency(object_name, present)
  where not present;

  if v_missing is not null then
    raise exception 'Dependencias ausentes para ativacao do console operacional: %', v_missing;
  end if;

  with blockers as (
    select 'company_without_org' as blocker from public.companies where org_id is null
    union all
    select 'contract_without_org' from public.contracts where org_id is null
    union all
    select 'project_without_org' from public.projects where org_id is null
    union all
    select 'team_without_org' from public.teams where org_id is null
    union all
    select 'contract_company_cross_tenant'
    from public.contracts contract
    join public.companies company on company.id = contract.company_id
    where contract.org_id is distinct from company.org_id
    union all
    select 'project_contract_cross_tenant'
    from public.projects project
    join public.contracts contract on contract.id = project.contract_id
    where project.org_id is distinct from contract.org_id
    union all
    select 'contract_team_cross_tenant'
    from public.contract_teams relation
    join public.contracts contract on contract.id = relation.contract_id
    join public.teams team on team.id = relation.team_id
    where contract.org_id is distinct from team.org_id
  )
  select count(*) into v_blockers from blockers;

  if v_blockers <> 0 then
    raise exception 'Ativacao bloqueada: % bloqueadores tenant-scoped encontrados', v_blockers;
  end if;

  if not exists (
    select 1
    from public.organization_members member
    where member.org_id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
      and member.user_id = '3c472f37-eabb-4a95-a859-1a1cf89f5d37'::uuid
      and member.is_active
      and member.role::text in ('owner', 'admin')
  ) and not exists (
    select 1
    from public.platform_user_roles platform_role
    where platform_role.user_id = '3c472f37-eabb-4a95-a859-1a1cf89f5d37'::uuid
      and platform_role.role = 'platform_admin'
  ) then
    raise exception 'Ativacao bloqueada: Roberto sem autoridade operacional na SALES CONSULTORIA';
  end if;
end;
$$;

select public.set_organization_operational_console(true);

do $$
begin
  if not public.is_organization_operational_console_enabled() then
    raise exception 'Post-validation failed: console operacional nao foi ativado';
  end if;

  if not public.is_legacy_operational_admin_fallback_enabled() then
    raise exception 'Post-validation failed: fallback legado foi desligado indevidamente';
  end if;
end;
$$;

commit;

select
  public.is_organization_operational_console_enabled() = true as console_enabled,
  public.is_legacy_operational_admin_fallback_enabled() = true as legacy_fallback_preserved,
  (
    public.is_organization_operational_console_enabled() = true
    and public.is_legacy_operational_admin_fallback_enabled() = true
  ) as organization_operational_console_activation_ok;
