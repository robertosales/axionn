-- Axion SaaS — Fase 2A / Lote 2C
-- Restaura um membership administrativo já existente no tenant principal.
-- Não cria membership, não altera papel e não concede platform_admin.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260704:02c_restore_primary_owner_access')
);

do $$
declare
  v_user_id uuid := '3c472f37-eabb-4a95-a859-1a1cf89f5d37'::uuid;
  v_org_id uuid := 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid;
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.organization_members') is null
     or to_regprocedure('public.is_organization_admin(uuid,uuid)') is null then
    raise exception 'Dependências do Lote 2 ausentes';
  end if;

  if not exists (
    select 1
    from public.organizations organization
    where organization.id = v_org_id
      and upper(btrim(organization.name)) = 'SALES CONSULTORIA'
      and lower(btrim(organization.slug)) = 'sales-consultoria'
      and organization.plan::text = 'enterprise'
      and organization.status::text = 'active'
  ) then
    raise exception 'Identidade exata do tenant SALES CONSULTORIA não confirmada';
  end if;

  if not exists (
    select 1
    from public.organization_members member
    where member.org_id = v_org_id
      and member.user_id = v_user_id
      and member.role::text in ('owner', 'admin')
  ) then
    raise exception 'Membership administrativo pré-existente não encontrado';
  end if;

  update public.organization_members
  set is_active = true,
      updated_by = v_user_id
  where org_id = v_org_id
    and user_id = v_user_id
    and role::text in ('owner', 'admin');

  if not public.is_organization_admin(v_org_id, v_user_id) then
    raise exception 'Validação falhou: acesso administrativo não foi restaurado';
  end if;
end;
$$;

commit;

select
  organization.id as organization_id,
  organization.name as organization_name,
  organization.slug,
  member.user_id,
  member.role::text as membership_role,
  member.is_active,
  public.is_organization_admin(organization.id, member.user_id)
    as organization_admin_access,
  (
    organization.id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
    and upper(btrim(organization.name)) = 'SALES CONSULTORIA'
    and lower(btrim(organization.slug)) = 'sales-consultoria'
    and member.user_id = '3c472f37-eabb-4a95-a859-1a1cf89f5d37'::uuid
    and member.is_active
    and member.role::text in ('owner', 'admin')
    and public.is_organization_admin(organization.id, member.user_id)
  ) as primary_owner_members_page_access_ok
from public.organization_members member
join public.organizations organization
  on organization.id = member.org_id
where member.user_id = '3c472f37-eabb-4a95-a859-1a1cf89f5d37'::uuid
  and organization.id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid;
