-- Axion SaaS - Fase 2B / Lote 8
-- Desliga somente o fallback legado do painel operacional global.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260704:07_disable_legacy_operational_admin_fallback')
);

do $$
declare
  v_blockers bigint;
begin
  if not public.is_organization_operational_console_enabled() then
    raise exception 'Fallback nao pode ser desligado antes de ativar o console operacional';
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
    select 'inactive_membership_with_modules'
    from public.organization_member_modules module_access
    join public.organization_members member
      on member.org_id = module_access.org_id
     and member.user_id = module_access.user_id
    where not member.is_active
  )
  select count(*) into v_blockers from blockers;

  if v_blockers <> 0 then
    raise exception 'Desligamento bloqueado: % bloqueadores operacionais encontrados', v_blockers;
  end if;
end;
$$;

select public.set_legacy_operational_admin_fallback(false);

do $$
begin
  if public.is_legacy_operational_admin_fallback_enabled() then
    raise exception 'Post-validation failed: fallback operacional ainda esta ligado';
  end if;

  if not public.is_organization_operational_console_enabled() then
    raise exception 'Post-validation failed: console operacional foi desligado';
  end if;
end;
$$;

commit;

select
  public.is_organization_operational_console_enabled() = true as console_enabled,
  public.is_legacy_operational_admin_fallback_enabled() = false as legacy_fallback_disabled,
  (
    public.is_organization_operational_console_enabled() = true
    and public.is_legacy_operational_admin_fallback_enabled() = false
  ) as legacy_operational_admin_fallback_disable_ok;
