-- Corporate integration telemetry is backend-authored and client-readable only
-- through the existing tenant-scoped SELECT policies.

drop policy if exists "redmine_issue_links_manage_service" on public.redmine_issue_links;
drop policy if exists "redmine_sync_events_insert_service" on public.redmine_sync_events;
drop policy if exists "oracle_sync_events_insert_service" on public.oracle_sync_events;
drop policy if exists "apex_usage_events_insert_service" on public.apex_usage_events;

revoke insert, update, delete on public.redmine_issue_links from public, anon, authenticated;
revoke insert, update, delete on public.redmine_sync_events from public, anon, authenticated;
revoke insert, update, delete on public.oracle_sync_events from public, anon, authenticated;
revoke insert, update, delete on public.apex_usage_events from public, anon, authenticated;

grant all on public.redmine_issue_links, public.redmine_sync_events,
  public.oracle_sync_events, public.apex_usage_events to service_role;

create policy "redmine_issue_links_service_role_write" on public.redmine_issue_links
  for all to service_role using (true) with check (true);
create policy "redmine_sync_events_service_role_insert" on public.redmine_sync_events
  for insert to service_role with check (true);
create policy "oracle_sync_events_service_role_insert" on public.oracle_sync_events
  for insert to service_role with check (true);
create policy "apex_usage_events_service_role_insert" on public.apex_usage_events
  for insert to service_role with check (true);

revoke all on function public.log_redmine_sync_event(
  uuid, uuid, text, text, text, integer, integer, integer, integer, integer, jsonb, uuid
) from public, anon, authenticated;
revoke all on function public.log_oracle_sync_event(
  uuid, uuid, uuid, text, text, integer, integer, integer, integer, bigint,
  integer, integer, integer, integer, jsonb, jsonb, jsonb, uuid
) from public, anon, authenticated;
revoke all on function public.log_apex_usage_event(
  uuid, uuid, uuid, text, text, integer, integer, text, text, jsonb,
  integer, integer, integer, uuid, uuid
) from public, anon, authenticated;

grant execute on function public.log_redmine_sync_event(
  uuid, uuid, text, text, text, integer, integer, integer, integer, integer, jsonb, uuid
) to service_role;
grant execute on function public.log_oracle_sync_event(
  uuid, uuid, uuid, text, text, integer, integer, integer, integer, bigint,
  integer, integer, integer, integer, jsonb, jsonb, jsonb, uuid
) to service_role;
grant execute on function public.log_apex_usage_event(
  uuid, uuid, uuid, text, text, integer, integer, text, text, jsonb,
  integer, integer, integer, uuid, uuid
) to service_role;

