-- SIMULACAO COMPLEMENTAR DE 70 REGISTROS ORFAOS - SEM COMMIT.

begin;
set local lock_timeout='5s';
set local statement_timeout='5min';

create temp table residual_cleanup_log(
  relation text primary key, expected bigint, affected bigint
) on commit drop;

do $identity_guard$
declare n bigint;
begin
  select count(*) into n from auth.users
  where id in ('2619b3ad-5d10-4a8f-ba1d-c37247456e93','a70662ce-136f-48d3-b855-8011c3821dd3');
  if n<>0 then raise exception 'ABORT: UUID residual voltou a existir em auth.users'; end if;

  select count(*) into n from public.profiles
  where id in ('2619b3ad-5d10-4a8f-ba1d-c37247456e93','a70662ce-136f-48d3-b855-8011c3821dd3')
     or user_id in ('2619b3ad-5d10-4a8f-ba1d-c37247456e93','a70662ce-136f-48d3-b855-8011c3821dd3');
  if n<>0 then raise exception 'ABORT: UUID residual voltou a existir em profiles'; end if;
end $identity_guard$;

with d as (delete from public.migration_demanda_hours_log where user_id='2619b3ad-5d10-4a8f-ba1d-c37247456e93' returning 1)
insert into residual_cleanup_log select 'migration_demanda_hours_log',25,count(*) from d;
with d as (delete from public.demanda_hours where user_id='2619b3ad-5d10-4a8f-ba1d-c37247456e93' returning 1)
insert into residual_cleanup_log select 'demanda_hours',15,count(*) from d;
with d as (delete from public.demanda_hours_backup_20260511 where user_id='2619b3ad-5d10-4a8f-ba1d-c37247456e93' returning 1)
insert into residual_cleanup_log select 'demanda_hours_backup_20260511',15,count(*) from d;
with d as (delete from public._backup_demanda_hours_p5 where user_id='2619b3ad-5d10-4a8f-ba1d-c37247456e93' returning 1)
insert into residual_cleanup_log select '_backup_demanda_hours_p5',10,count(*) from d;
with d as (delete from public.demanda_hours_backup_minutos where user_id='2619b3ad-5d10-4a8f-ba1d-c37247456e93' returning 1)
insert into residual_cleanup_log select 'demanda_hours_backup_minutos',2,count(*) from d;
with d as (delete from public.notifications where user_id='a70662ce-136f-48d3-b855-8011c3821dd3' returning 1)
insert into residual_cleanup_log select 'notifications',3,count(*) from d;

do $count_guard$
declare invalid_count bigint; total_count bigint;
begin
  select count(*) into invalid_count
  from residual_cleanup_log where affected<>expected;
  select coalesce(sum(affected),0) into total_count from residual_cleanup_log;
  if invalid_count<>0 or total_count<>70 then
    raise exception 'ABORT: contagens divergentes; tabelas=% total=%',invalid_count,total_count;
  end if;
end $count_guard$;

select relation,expected,affected,
       case when expected=affected then 'OK' else 'FAIL' end status
from residual_cleanup_log order by relation;

rollback;
