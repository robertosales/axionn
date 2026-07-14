-- VALIDACAO POS-LIMPEZA - SOMENTE LEITURA - LOVABLE SQL EDITOR.

begin transaction read only;

with whitelist(email) as (values
 ('alissandra.teixeira@globalweb.com.br'), ('edsonrj@globalweb.com.br'),
 ('gabrielca@globalweb.com.br'), ('rafael.angelo@globalweb.com.br'),
 ('rjoacina@gmail.com'), ('roberto.sales@gmail.com'),
 ('leidybsb@gmail.com'), ('fatima.ferni@gmail.com')
), kept_users as (
  select u.id, lower(trim(u.email)) email
  from auth.users u join whitelist w on w.email=lower(trim(u.email))
), kept_identity_ids as (
  select id from kept_users
  union
  select p.id from public.profiles p join kept_users k on k.id=p.user_id
), checks as (
  select 10 sort_order, 'AUTH_TOTAL' check_name, count(*)::bigint actual, 8::bigint expected
  from auth.users
  union all
  select 20, 'AUTH_OUTSIDE_WHITELIST', count(*), 0
  from auth.users u where not exists(select 1 from whitelist w where w.email=lower(trim(u.email)))
  union all
  select 30, 'WHITELIST_MISSING_OR_DUPLICATED', count(*), 0
  from whitelist w where (select count(*) from auth.users u where lower(trim(u.email))=w.email)<>1
  union all
  select 40, 'PROFILES_ORPHAN', count(*), 0
  from public.profiles p left join auth.users u on u.id=p.user_id where u.id is null
  union all
  select 50, 'PROFILES_OUTSIDE_WHITELIST', count(*), 0
  from public.profiles p where not exists(select 1 from kept_users k where k.id=p.user_id)
  union all
  select 60, 'TEAM_MEMBERS_ORPHAN_OR_REMOVED', count(*), 0
  from public.team_members x where not exists(select 1 from kept_users k where k.id=x.user_id)
  union all
  select 70, 'ORG_MEMBERS_ORPHAN_OR_REMOVED', count(*), 0
  from public.organization_members x where not exists(select 1 from kept_users k where k.id=x.user_id)
  union all
  select 80, 'CONTRACT_MEMBERS_ORPHAN_OR_REMOVED', count(*), 0
  from public.contract_members x where not exists(select 1 from kept_users k where k.id=x.user_id)
  union all
  select 90, 'USER_ROLES_ORPHAN_OR_REMOVED', count(*), 0
  from public.user_roles x where not exists(select 1 from kept_users k where k.id=x.user_id)
  union all
  select 100, 'MODULE_ROLES_ORPHAN_OR_REMOVED', count(*), 0
  from public.user_module_roles x where not exists(select 1 from kept_users k where k.id=x.user_id)
  union all
  select 110, 'DEVELOPERS_ORPHAN_OR_REMOVED', count(*), 0
  from public.developers x where x.user_id is not null
    and not exists(select 1 from kept_users k where k.id=x.user_id)
  union all
  select 120, 'DEMANDAS_INVALID_DEMANDANTE', count(*), 0
  from public.demandas d where d.demandante is not null
    and not exists(select 1 from public.profiles p where p.id=d.demandante)
  union all
  select 130, 'TEAMS_INVALID_CREATED_BY', count(*), 0
  from public.teams t where t.created_by is not null
    and not exists(select 1 from kept_users k where k.id=t.created_by)
  union all
  select 140, 'STORAGE_OUTSIDE_WHITELIST', count(*), 0
  from storage.objects o where o.owner is not null
    and not exists(select 1 from kept_users k where k.id=o.owner)
  union all
  select 150, 'PERSONAL_ROWS_OUTSIDE_WHITELIST', count(*), 0
  from (
    select user_id id from public._backup_demanda_hours_p5
    union all select user_id from public.calendar_events
    union all select user_id from public.demanda_eventos
    union all select user_id from public.demanda_evidencias
    union all select user_id from public.demanda_hours_backup_20260511
    union all select user_id from public.demanda_hours_backup_minutos
    union all select user_id from public.demanda_hours
    union all select user_id from public.demanda_transitions
    union all select user_id from public.migration_demanda_hours_log
    union all select user_id from public.notifications
    union all select subject_user_id from public.organization_membership_audit_log
    union all select user_id from public.planning_participants
    union all select user_id from public.planning_votes
    union all select user_id from public.platform_user_roles
  ) residual
  where residual.id is not null
    and not exists(select 1 from kept_identity_ids k where k.id=residual.id)
)
select check_name, actual, expected,
       case when actual=expected then 'OK' else 'FAIL' end status
from checks
order by sort_order;

rollback;
