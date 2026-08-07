-- APF automation settings: tenant-scoped persistence and atomic execution.
create table if not exists public.apf_automation_settings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references public.teams(id) on delete cascade,
  auto_approve_enabled boolean not null default false,
  min_occurrences integer not null default 10 check (min_occurrences between 3 and 50),
  max_correction_rate numeric(5,4) not null default 0.10 check (max_correction_rate between 0 and 0.30),
  drift_alert_enabled boolean not null default true,
  drift_threshold_pp numeric(5,2) not null default 10 check (drift_threshold_pp between 3 and 30),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.apf_automation_settings enable row level security;
revoke all on public.apf_automation_settings from anon, public;
grant select, insert, update on public.apf_automation_settings to authenticated;
grant all on public.apf_automation_settings to service_role;

create policy "apf_automation_settings_select_team" on public.apf_automation_settings
  for select to authenticated using (public.is_team_member(auth.uid(), team_id) or public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "apf_automation_settings_insert_team" on public.apf_automation_settings
  for insert to authenticated with check ((public.is_team_member(auth.uid(), team_id) or public.has_role(auth.uid(), 'admin'::public.app_role)) and created_by = auth.uid() and updated_by = auth.uid());
create policy "apf_automation_settings_update_team" on public.apf_automation_settings
  for update to authenticated using (public.is_team_member(auth.uid(), team_id) or public.has_role(auth.uid(), 'admin'::public.app_role))
  with check ((public.is_team_member(auth.uid(), team_id) or public.has_role(auth.uid(), 'admin'::public.app_role)) and updated_by = auth.uid());
create policy "apf_automation_settings_service_role" on public.apf_automation_settings
  for all to service_role using (true) with check (true);

drop trigger if exists audit_log_trigger on public.apf_automation_settings;
create trigger audit_log_trigger after insert or update or delete on public.apf_automation_settings
  for each row execute function public.audit_log_trigger_fn();

create or replace function public.run_apf_auto_approve(p_team_id uuid)
returns table(pattern_id uuid)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_config public.apf_automation_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not (public.is_team_member(auth.uid(), p_team_id) or public.has_role(auth.uid(), 'admin'::public.app_role)) then
    raise exception 'team_access_denied' using errcode = '42501';
  end if;
  select * into v_config from public.apf_automation_settings where team_id = p_team_id for update;
  if not found or not v_config.auto_approve_enabled then
    raise exception 'apf_auto_approve_disabled' using errcode = '22023';
  end if;
  return query
  update public.apf_knowledge_patterns pattern
     set status = 'validated', validated_at = now(), validated_by = auth.uid(), updated_at = now()
   where pattern.team_id = p_team_id and pattern.status = 'auto'
     and coalesce(pattern.occurrence_count, 0) >= v_config.min_occurrences
     and coalesce(pattern.correction_rate, 1) <= v_config.max_correction_rate
  returning pattern.id;
end;
$$;
revoke all on function public.run_apf_auto_approve(uuid) from public, anon;
grant execute on function public.run_apf_auto_approve(uuid) to authenticated, service_role;
