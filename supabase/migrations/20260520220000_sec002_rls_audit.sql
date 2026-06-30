-- SEC-002 — RLS audit aligned with the canonical schema.

begin;

-- Core team-scoped resources all expose team_id.
do $$
declare
  relation_name text;
  prefix text;
begin
  foreach relation_name in array array[
    'sprints',
    'user_stories',
    'activities',
    'impediments'
  ]
  loop
    prefix := case relation_name
      when 'sprints' then 'sprints'
      when 'user_stories' then 'us'
      when 'activities' then 'act'
      else 'imp'
    end;

    execute format('alter table public.%I enable row level security', relation_name);
    execute format('drop policy if exists %I on public.%I', prefix || '_select', relation_name);
    execute format('drop policy if exists %I on public.%I', prefix || '_admin_select', relation_name);
    execute format('drop policy if exists %I on public.%I', prefix || '_admin_all', relation_name);
    execute format('drop policy if exists %I on public.%I', prefix || '_insert', relation_name);
    execute format('drop policy if exists %I on public.%I', prefix || '_update', relation_name);
    execute format('drop policy if exists %I on public.%I', prefix || '_delete', relation_name);

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_admin() or public.is_team_member(auth.uid(), team_id))',
      prefix || '_select', relation_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_admin() or public.is_team_member(auth.uid(), team_id))',
      prefix || '_insert', relation_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_admin() or public.is_team_member(auth.uid(), team_id)) with check (public.is_admin() or public.is_team_member(auth.uid(), team_id))',
      prefix || '_update', relation_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_admin())',
      prefix || '_delete', relation_name
    );
  end loop;
end;
$$;

-- Optional legacy table.
do $$
begin
  if to_regclass('public.sprint_impediments') is not null then
    execute 'alter table public.sprint_impediments enable row level security';
  end if;
end;
$$;

-- APF generation ownership uses generated_by and team_id.
alter table public.apf_generations enable row level security;
drop policy if exists apf_select on public.apf_generations;
drop policy if exists apf_admin_select on public.apf_generations;
drop policy if exists apf_insert on public.apf_generations;
drop policy if exists apf_update on public.apf_generations;
drop policy if exists apf_delete on public.apf_generations;

create policy apf_select on public.apf_generations
for select to authenticated
using (
  public.is_admin()
  or generated_by = auth.uid()
  or public.is_team_member(auth.uid(), team_id)
);

create policy apf_insert on public.apf_generations
for insert to authenticated
with check (
  public.is_admin()
  or (generated_by = auth.uid() and public.is_team_member(auth.uid(), team_id))
);

create policy apf_update on public.apf_generations
for update to authenticated
using (public.is_admin() or generated_by = auth.uid())
with check (public.is_admin() or generated_by = auth.uid());

create policy apf_delete on public.apf_generations
for delete to authenticated
using (public.is_admin() or generated_by = auth.uid());

-- RDM policies are owned by the module migrations. Only ensure RLS where present.
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'rdms', 'rdm_sprint_items', 'rdm_participantes',
    'rdm_checklist_templates', 'rdm_checklist_items',
    'rdm_deployment_tasks', 'rdm_gonogo', 'rdm_audit_log'
  ]
  loop
    if to_regclass('public.' || relation_name) is not null then
      execute format('alter table public.%I enable row level security', relation_name);
    end if;
  end loop;
end;
$$;

alter table public.user_module_roles enable row level security;
drop policy if exists umr_select_own on public.user_module_roles;
drop policy if exists umr_admin_all on public.user_module_roles;
create policy umr_select_own on public.user_module_roles
for select to authenticated using (user_id = auth.uid());
create policy umr_admin_all on public.user_module_roles
for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.user_management_audit_log enable row level security;
drop policy if exists audit_admin_select on public.user_management_audit_log;
create policy audit_admin_select on public.user_management_audit_log
for select to authenticated using (public.is_admin());

commit;
