-- Axion SaaS — Fase 2A / Lote 2C
-- Operação manual para garantir que roberto.sales@gmail.com visualize e acesse
-- /organization/members na organização SALES CONSULTORIA.
--
-- Pré-requisitos:
--   1. 20260704_02_organization_member_invitations_rollout.sql
--   2. 20260704_02a_organization_member_query_hardening.sql
--   3. 20260704_02b_organization_module_access_runtime.sql
--   4. frontend publicado com VITE_ORG_TENANCY_ENABLED=true
--
-- Esta operação não concede platform_admin. Ela preserva owner existente e,
-- caso o usuário ainda não pertença à organização, concede somente admin.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260704:02c_ensure_roberto_organization_admin')
);

do $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_existing_role text;
  v_missing text;
begin
  select string_agg(object_name, ', ' order by object_name)
  into v_missing
  from (
    values
      ('auth.users', to_regclass('auth.users') is not null),
      ('public.organizations', to_regclass('public.organizations') is not null),
      ('public.organization_members', to_regclass('public.organization_members') is not null),
      ('organization_members.is_active', exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'organization_members'
          and column_name = 'is_active'
      )),
      ('get_my_organizations_v2()', to_regprocedure('public.get_my_organizations_v2()') is not null),
      ('is_organization_admin(uuid,uuid)', to_regprocedure('public.is_organization_admin(uuid,uuid)') is not null)
  ) dependency(object_name, present)
  where not present;

  if v_missing is not null then
    raise exception
      'Dependências ausentes. Execute primeiro as Operações 02, 02A e 02B: %',
      v_missing;
  end if;

  select user_account.id
  into v_user_id
  from auth.users user_account
  where lower(btrim(user_account.email)) = 'roberto.sales@gmail.com'
  order by user_account.created_at
  limit 1;

  if v_user_id is null then
    raise exception
      'Usuário roberto.sales@gmail.com não encontrado em auth.users';
  end if;

  select organization.id
  into v_org_id
  from public.organizations organization
  where organization.id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
     or lower(organization.slug) = 'sales-consultoria'
  order by
    case
      when organization.id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid then 0
      else 1
    end
  limit 1;

  if v_org_id is null then
    raise exception
      'Organização SALES CONSULTORIA não encontrada pelo UUID ou slug esperados';
  end if;

  select member.role::text
  into v_existing_role
  from public.organization_members member
  where member.org_id = v_org_id
    and member.user_id = v_user_id;

  insert into public.organization_members (
    org_id,
    user_id,
    role,
    joined_at,
    is_active,
    updated_by
  )
  values (
    v_org_id,
    v_user_id,
    case
      when v_existing_role = 'owner' then 'owner'::public.org_member_role
      else 'admin'::public.org_member_role
    end,
    now(),
    true,
    v_user_id
  )
  on conflict (org_id, user_id) do update
  set role = case
        when organization_members.role::text = 'owner'
          then organization_members.role
        else 'admin'::public.org_member_role
      end,
      is_active = true,
      updated_by = v_user_id;

  if not public.is_organization_admin(v_org_id, v_user_id) then
    raise exception
      'Validação falhou: Roberto ainda não é administrador da organização';
  end if;
end;
$$;

commit;

select
  user_account.email,
  organization.id as organization_id,
  organization.name as organization_name,
  organization.slug,
  member.role::text as membership_role,
  member.is_active,
  public.is_organization_admin(organization.id, user_account.id)
    as organization_admin_access,
  (
    member.is_active
    and member.role::text in ('owner', 'admin')
    and public.is_organization_admin(organization.id, user_account.id)
  ) as roberto_members_page_access_ok
from auth.users user_account
join public.organization_members member
  on member.user_id = user_account.id
join public.organizations organization
  on organization.id = member.org_id
where lower(btrim(user_account.email)) = 'roberto.sales@gmail.com'
  and (
    organization.id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
    or lower(organization.slug) = 'sales-consultoria'
  );
