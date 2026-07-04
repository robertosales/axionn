-- Axion SaaS - Fase 2B / Lote 8
-- Rollback rapido: religa fallback operacional e opcionalmente desliga o console.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260704:07_organization_operational_console_rollback')
);

select public.set_legacy_operational_admin_fallback(true);
select public.set_organization_operational_console(false);

do $$
begin
  if not public.is_legacy_operational_admin_fallback_enabled() then
    raise exception 'Rollback failed: fallback operacional nao foi religado';
  end if;

  if public.is_organization_operational_console_enabled() then
    raise exception 'Rollback failed: console operacional ainda esta ativo';
  end if;
end;
$$;

commit;

select
  public.is_legacy_operational_admin_fallback_enabled() = true as legacy_fallback_enabled,
  public.is_organization_operational_console_enabled() = false as console_disabled,
  (
    public.is_legacy_operational_admin_fallback_enabled() = true
    and public.is_organization_operational_console_enabled() = false
  ) as organization_operational_console_rollback_ok;
