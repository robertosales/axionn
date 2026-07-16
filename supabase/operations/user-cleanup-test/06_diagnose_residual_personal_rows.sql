-- DIAGNOSTICO DE REGISTROS PESSOAIS RESIDUAIS - SOMENTE LEITURA.

begin transaction read only;

with whitelist(email) as (values
 ('alissandra.teixeira@globalweb.com.br'), ('edsonrj@globalweb.com.br'),
 ('gabrielca@globalweb.com.br'), ('rafael.angelo@globalweb.com.br'),
 ('rjoacina@gmail.com'), ('roberto.sales@gmail.com'),
 ('leidybsb@gmail.com'), ('fatima.ferni@gmail.com')
), kept_users as (
  select u.id from auth.users u join whitelist w on w.email=lower(trim(u.email))
), kept_identity_ids as (
  select id from kept_users
  union
  select p.id from public.profiles p join kept_users k on k.id=p.user_id
), residual(source_table, identity_id) as (
  select '_backup_demanda_hours_p5',user_id from public._backup_demanda_hours_p5
  union all select 'calendar_events',user_id from public.calendar_events
  union all select 'demanda_eventos',user_id from public.demanda_eventos
  union all select 'demanda_evidencias',user_id from public.demanda_evidencias
  union all select 'demanda_hours_backup_20260511',user_id from public.demanda_hours_backup_20260511
  union all select 'demanda_hours_backup_minutos',user_id from public.demanda_hours_backup_minutos
  union all select 'demanda_hours',user_id from public.demanda_hours
  union all select 'demanda_transitions',user_id from public.demanda_transitions
  union all select 'migration_demanda_hours_log',user_id from public.migration_demanda_hours_log
  union all select 'notifications',user_id from public.notifications
  union all select 'organization_membership_audit_log',subject_user_id from public.organization_membership_audit_log
  union all select 'planning_participants',user_id from public.planning_participants
  union all select 'planning_votes',user_id from public.planning_votes
  union all select 'platform_user_roles',user_id from public.platform_user_roles
), outside_whitelist as (
  select r.*
  from residual r
  where r.identity_id is not null
    and not exists(select 1 from kept_identity_ids k where k.id=r.identity_id)
)
select source_table,
       count(*) as residual_rows,
       count(distinct identity_id) as distinct_identity_ids,
       array_agg(distinct identity_id order by identity_id) as identity_ids
from outside_whitelist
group by source_table
order by residual_rows desc, source_table;

rollback;
