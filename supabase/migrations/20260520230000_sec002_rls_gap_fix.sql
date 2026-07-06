-- SEC-002 — RLS gap fix aligned with clean database replay.

begin;

-- Backup tables are installation-dependent. When present, RLS without
-- authenticated policies blocks direct client access while preserving service access.
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    '_backup_demanda_hours_p5',
    'demanda_hours_backup_20260511',
    'demanda_hours_backup_minutos'
  ]
  loop
    if to_regclass('public.' || relation_name) is not null then
      execute format('alter table public.%I enable row level security', relation_name);
      execute format('alter table public.%I force row level security', relation_name);
    end if;
  end loop;
end;
$$;

alter table public.migration_demanda_hours_log enable row level security;
alter table public.migration_demanda_hours_log force row level security;
drop policy if exists mig_log_admin_select on public.migration_demanda_hours_log;
create policy mig_log_admin_select on public.migration_demanda_hours_log
for select to authenticated
using (public.is_admin());

-- RBAC catalog: authenticated read, administrative writes.
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'app_roles',
    'app_permissions',
    'role_permissions'
  ]
  loop
    if to_regclass('public.' || relation_name) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', relation_name);
    execute format('drop policy if exists %I on public.%I', relation_name || '_auth_select', relation_name);
    execute format('drop policy if exists %I on public.%I', relation_name || '_admin_insert', relation_name);
    execute format('drop policy if exists %I on public.%I', relation_name || '_admin_update', relation_name);
    execute format('drop policy if exists %I on public.%I', relation_name || '_admin_delete', relation_name);

    execute format(
      'create policy %I on public.%I for select to authenticated using (auth.uid() is not null)',
      relation_name || '_auth_select', relation_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_admin())',
      relation_name || '_admin_insert', relation_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',
      relation_name || '_admin_update', relation_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_admin())',
      relation_name || '_admin_delete', relation_name
    );
  end loop;
end;
$$;

-- Teams
alter table public.teams enable row level security;
drop policy if exists teams_select on public.teams;
drop policy if exists teams_insert on public.teams;
drop policy if exists teams_update on public.teams;
drop policy if exists teams_delete on public.teams;

create policy teams_select on public.teams
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.team_members member
    where member.team_id = teams.id
      and member.user_id = auth.uid()
  )
);

create policy teams_insert on public.teams
for insert to authenticated with check (public.is_admin());
create policy teams_update on public.teams
for update to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy teams_delete on public.teams
for delete to authenticated using (public.is_admin());

-- Global legacy roles
alter table public.user_roles enable row level security;
drop policy if exists user_roles_select on public.user_roles;
drop policy if exists user_roles_insert on public.user_roles;
drop policy if exists user_roles_update on public.user_roles;
drop policy if exists user_roles_delete on public.user_roles;

create policy user_roles_select on public.user_roles
for select to authenticated
using (public.is_admin() or user_id = auth.uid());
create policy user_roles_insert on public.user_roles
for insert to authenticated with check (public.is_admin());
create policy user_roles_update on public.user_roles
for update to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy user_roles_delete on public.user_roles
for delete to authenticated using (public.is_admin());

-- RDM checklist catalog
alter table public.rdm_checklist_templates enable row level security;
drop policy if exists rdm_checklist_templates_auth_select on public.rdm_checklist_templates;
drop policy if exists rdm_checklist_templates_admin_insert on public.rdm_checklist_templates;
drop policy if exists rdm_checklist_templates_admin_update on public.rdm_checklist_templates;
drop policy if exists rdm_checklist_templates_admin_delete on public.rdm_checklist_templates;

create policy rdm_checklist_templates_auth_select
on public.rdm_checklist_templates
for select to authenticated using (auth.uid() is not null);
create policy rdm_checklist_templates_admin_insert
on public.rdm_checklist_templates
for insert to authenticated with check (public.is_admin());
create policy rdm_checklist_templates_admin_update
on public.rdm_checklist_templates
for update to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy rdm_checklist_templates_admin_delete
on public.rdm_checklist_templates
for delete to authenticated using (public.is_admin());

commit;
