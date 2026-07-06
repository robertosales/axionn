begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(3);

select ok(
  public.is_organization_legacy_permission_fallback_enabled(),
  'hotfix keeps the legacy granular permission fallback enabled'
);

select throws_ok(
  $sql$ select public.set_organization_legacy_permission_fallback(false) $sql$,
  '55000',
  'organization_granular_permissions_not_ready',
  'fallback cannot be disabled before organization-scoped granular permissions are ready'
);

select lives_ok(
  $sql$ select public.set_organization_legacy_permission_fallback(true) $sql$,
  'fallback can be explicitly kept enabled'
);

select * from finish();
rollback;
