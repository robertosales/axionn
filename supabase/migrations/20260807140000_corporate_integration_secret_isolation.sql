-- Corporate integration credentials are backend-only. The sanitized registry
-- remains the supported read surface for organization administrators.

drop policy if exists "redmine_integrations_select_org_admin" on public.redmine_integrations;
drop policy if exists "redmine_integrations_manage_org_admin" on public.redmine_integrations;
drop policy if exists "oracle_integrations_select_org_admin" on public.oracle_integrations;
drop policy if exists "oracle_integrations_manage_org_admin" on public.oracle_integrations;
drop policy if exists "apex_integrations_select_org_admin" on public.apex_integrations;
drop policy if exists "apex_integrations_manage_org_admin" on public.apex_integrations;

revoke all on public.redmine_integrations from public, anon, authenticated;
revoke all on public.oracle_integrations from public, anon, authenticated;
revoke all on public.apex_integrations from public, anon, authenticated;

grant all on public.redmine_integrations to service_role;
grant all on public.oracle_integrations to service_role;
grant all on public.apex_integrations to service_role;

create policy "redmine_integrations_service_role_only"
  on public.redmine_integrations for all to service_role
  using (true) with check (true);
create policy "oracle_integrations_service_role_only"
  on public.oracle_integrations for all to service_role
  using (true) with check (true);
create policy "apex_integrations_service_role_only"
  on public.apex_integrations for all to service_role
  using (true) with check (true);

comment on table public.redmine_integrations is
  'Backend-only integration configuration. Credentials must never be selected by browser roles; use get_integration_registry for sanitized status.';
comment on table public.oracle_integrations is
  'Backend-only integration configuration. Credentials must never be selected by browser roles; use get_integration_registry for sanitized status.';
comment on table public.apex_integrations is
  'Backend-only integration configuration. Credentials must never be selected by browser roles; use get_integration_registry for sanitized status.';

