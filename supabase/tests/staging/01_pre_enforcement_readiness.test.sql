begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

select is(
  (
    select count(*)::integer
    from public.get_tenancy_readiness_report()
  ),
  9,
  'readiness report exposes every required isolation check'
);

select is(
  (
    select coalesce(sum(affected_rows), 0)::bigint
    from public.get_tenancy_readiness_report()
  ),
  0::bigint,
  'all central resources have consistent organization ownership'
);

select is(
  (
    select count(*)::integer
    from public.organizations organization
    where not exists (
      select 1
      from public.organization_members member
      where member.org_id = organization.id
        and member.role in ('owner', 'admin')
    )
  ),
  0,
  'every organization has at least one owner or administrator'
);

select ok(
  exists (
    select 1
    from public.platform_user_roles role
    where role.role = 'platform_admin'
  ),
  'staging has at least one platform administrator'
);

select is(
  public.is_tenancy_enforced(),
  false,
  'pre-enforcement readiness runs while database enforcement is disabled'
);

select * from finish();
rollback;
