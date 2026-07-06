begin;
select public.set_organization_resource_limit_enforcement(false);
commit;
select not public.is_organization_resource_limit_enforced() as organization_resource_limit_rollback_ok;
