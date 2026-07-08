-- Consolida leitura organizacional sobre recursos operacionais legados.
-- A escrita continua obedecendo às políticas específicas de cada módulo.

do $$
declare
  v_table text;
  v_policy text;
  v_team_scoped_tables constant text[] := array[
    'attachments',
    'activity_comments',
    'team_members',
    'developers',
    'sprints',
    'epics',
    'user_stories',
    'activities',
    'impediments',
    'custom_field_definitions',
    'automation_rules',
    'workflow_columns',
    'demandas',
    'projetos',
    'releases',
    'slas',
    'apf_templates',
    'apf_generations'
  ];
begin
  foreach v_table in array v_team_scoped_tables loop
    if to_regclass(format('public.%I', v_table)) is not null
       and exists (
         select 1
         from information_schema.columns column_info
         where column_info.table_schema = 'public'
           and column_info.table_name = v_table
           and column_info.column_name = 'team_id'
       ) then
      v_policy := v_table || '_organization_admin_select';

      execute format(
        'drop policy if exists %I on public.%I',
        v_policy,
        v_table
      );
      execute format(
        'create policy %I on public.%I for select to authenticated using (public.is_organization_team_admin(team_id, auth.uid()))',
        v_policy,
        v_table
      );
    end if;
  end loop;
end;
$$;

drop policy if exists teams_organization_admin_select
  on public.teams;
create policy teams_organization_admin_select
on public.teams
for select
to authenticated
using (public.is_organization_team_admin(id, auth.uid()));

comment on function public.is_organization_team_admin(uuid, uuid) is
  'Autoridade canônica para leitura de recursos de time por administradores da organização.';

select pg_notify('pgrst', 'reload schema');
