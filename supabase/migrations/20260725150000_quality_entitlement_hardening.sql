-- Quality Intelligence - hardening do gate comercial tenant-scoped.
-- Migration aditiva: nao altera migrations que podem ter sido aplicadas no Lovable Cloud.

begin;

create or replace function public.check_organization_has_quality_module(p_org_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'quality_entitlement_authentication_required';
  end if;

  if not public.is_platform_admin(auth.uid())
     and not public.is_organization_member(p_org_id, auth.uid()) then
    raise exception using
      errcode = '42501',
      message = 'quality_entitlement_access_denied';
  end if;

  -- O catalogo granular usa quality.cases.view como capacidade minima do modulo.
  -- A resolucao efetiva preserva overrides comerciais e janelas de vigencia.
  return exists (
    select 1
    from public.get_effective_organization_entitlements(p_org_id) entitlement
    where entitlement.feature_key = 'quality.cases.view'
      and entitlement.enabled
  );
end;
$$;

revoke all on function public.check_organization_has_quality_module(uuid)
  from public, anon, authenticated;
grant execute on function public.check_organization_has_quality_module(uuid)
  to authenticated, service_role;

comment on function public.check_organization_has_quality_module(uuid) is
  'Retorna o entitlement efetivo de Quality somente para membro do tenant ou platform admin.';

commit;
