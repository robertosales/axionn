-- SIMULAÃƒâ€¡ÃƒÆ’O PARA O SQL EDITOR DO LOVABLE Ã¢â‚¬â€ NÃƒÆ’O PERSISTE ALTERAÃƒâ€¡Ãƒâ€¢ES.
-- Ambiente alvo: teste. Conjunto esperado: 70 usuÃƒÂ¡rios.
-- Fingerprint esperado: 32ad083d26b41dd1506a9e2950ed672e.
-- Este arquivo termina obrigatoriamente em ROLLBACK.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '15min';
lock table auth.users in share row exclusive mode;

create temp table cleanup_whitelist(email text primary key) on commit drop;
insert into cleanup_whitelist values
 ('alissandra.teixeira@globalweb.com.br'), ('edsonrj@globalweb.com.br'),
 ('gabrielca@globalweb.com.br'), ('rafael.angelo@globalweb.com.br'),
 ('rjoacina@gmail.com'), ('roberto.sales@gmail.com'),
 ('leidybsb@gmail.com'), ('fatima.ferni@gmail.com');
create temp table cleanup_targets on commit drop as
select u.id user_id, lower(trim(u.email)) email, p.id profile_id
from auth.users u left join public.profiles p on p.user_id=u.id
where not exists(select 1 from cleanup_whitelist w where w.email=lower(trim(u.email)));

create temp table cleanup_personal_policy(
  table_schema text, table_name text, column_name text,
  primary key(table_schema,table_name,column_name)
) on commit drop;
insert into cleanup_personal_policy values
 ('public','_backup_demanda_hours_p5','user_id'),
 ('public','calendar_events','user_id'),
 ('public','demanda_eventos','user_id'),
 ('public','demanda_evidencias','user_id'),
 ('public','demanda_hours_backup_20260511','user_id'),
 ('public','demanda_hours_backup_minutos','user_id'),
 ('public','demanda_hours','user_id'),
 ('public','demanda_transitions','user_id'),
 ('public','migration_demanda_hours_log','user_id'),
 ('public','notifications','user_id'),
 ('public','organization_membership_audit_log','subject_user_id'),
 ('public','planning_participants','user_id'),
 ('public','planning_votes','user_id'),
 ('public','platform_user_roles','user_id');

do $fingerprint_guard$
declare
  actual_count bigint;
  actual_md5 text;
begin
  select count(*),
         md5(coalesce(string_agg(user_id::text,',' order by user_id),''))
  into actual_count, actual_md5
  from cleanup_targets;

  if actual_count <> 70 then
    raise exception 'ABORT: target_count esperado 70, obtido %', actual_count;
  end if;
  if actual_md5 <> '32ad083d26b41dd1506a9e2950ed672e' then
    raise exception 'ABORT: target_md5 divergiu do dry-run: %', actual_md5;
  end if;
end $fingerprint_guard$;

do $guard$
declare n int;
begin
  select count(*) into n from cleanup_whitelist w
  where (select count(*) from auth.users u where lower(trim(u.email))=w.email) <> 1;
  if n>0 then raise exception 'Whitelist ausente ou duplicada: % email(s)',n; end if;
end $guard$;

-- Sem FK, nenhuma deleÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o automÃƒÆ’Ã‚Â¡tica: o operador deve revisar/corrigir antes.
do $block$
declare r record; n bigint;
begin
  for r in
    select ns.nspname s, cl.relname t, a.attname c
    from pg_attribute a join pg_class cl on cl.oid=a.attrelid and cl.relkind in ('r','p')
    join pg_namespace ns on ns.oid=cl.relnamespace
    where a.attnum>0 and not a.attisdropped and a.atttypid='uuid'::regtype
      and ns.nspname not in ('pg_catalog','information_schema','auth','storage')
      and ns.nspname not like 'pg_temp_%'
      and ns.nspname not like 'pg_toast_temp_%'
      and a.attname ~* '(^user_id$|profile_id$|assignee_id$|actor_id$|owner_id$|created_by$|updated_by$|generated_by$|responsavel|demandante|target_id$|subject_user_id$)'
      and not exists(select 1 from pg_constraint c where c.contype='f' and c.conrelid=cl.oid and a.attnum=any(c.conkey))
      and not exists(select 1 from cleanup_personal_policy p
        where p.table_schema=ns.nspname and p.table_name=cl.relname and p.column_name=a.attname)
  loop
    execute format('select count(*) from %I.%I where %I in (select user_id from cleanup_targets union select profile_id from cleanup_targets where profile_id is not null)',r.s,r.t,r.c) into n;
    if n>0 then raise exception 'BLOCKER sem FK: %.%.% possui % vÃƒÆ’Ã‚Â­nculo(s)',r.s,r.t,r.c,n; end if;
  end loop;
end $block$;

create temp table cleanup_execution_log(phase int, relation text, affected bigint, executed_at timestamptz default clock_timestamp()) on commit drop;

-- Nunca apagar diretamente do catÃƒÆ’Ã‚Â¡logo: isso pode deixar blobs fÃƒÆ’Ã‚Â­sicos ÃƒÆ’Ã‚Â³rfÃƒÆ’Ã‚Â£os.
-- O manifesto do dry-run deve ser removido antes via Storage API/Dashboard.
do $storage_guard$
declare n bigint;
begin
  select count(*) into n from storage.objects o join cleanup_targets t
    on o.owner=t.user_id or split_part(o.name,'/',1)=t.user_id::text;
  if n>0 then
    raise exception 'BLOCKER Storage: % objeto(s) devem ser removidos via Storage API/Dashboard',n;
  end if;
end $storage_guard$;
insert into cleanup_execution_log(phase,relation,affected) values(1,'storage.objects (verified empty)',0);

-- PolÃƒÆ’Ã‚Â­tica aprovada: exclusÃƒÆ’Ã‚Â£o explÃƒÆ’Ã‚Â­cita de dados pessoais, histÃƒÆ’Ã‚Â³ricos, logs e backups.
do $personal_delete$
declare r record; n bigint;
begin
  for r in select * from cleanup_personal_policy order by table_schema,table_name,column_name
  loop
    execute format(
      'delete from %I.%I where %I in (select user_id from cleanup_targets union select profile_id from cleanup_targets where profile_id is not null)',
      r.table_schema,r.table_name,r.column_name
    );
    get diagnostics n=row_count;
    insert into cleanup_execution_log(phase,relation,affected)
    values(2,format('%I.%I.%I',r.table_schema,r.table_name,r.column_name),n);
  end loop;
end $personal_delete$;

-- Preserva entidades de negÃƒÆ’Ã‚Â³cio compartilhadas, removendo somente a atribuiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o pessoal.
with changed as (
  update public.demandas d set demandante=null
  where d.demandante in (select profile_id from cleanup_targets where profile_id is not null)
  returning 1
)
insert into cleanup_execution_log(phase,relation,affected)
select 2,'public.demandas.demandante -> NULL',count(*) from changed;

-- O trigger de tenancy valida a organização inteira mesmo quando apenas
-- created_by muda. Isolamos a tabela e suspendemos somente esse trigger durante
-- a alteração de autoria; FKs e demais triggers continuam ativos.
lock table public.teams in access exclusive mode;
alter table public.teams disable trigger trg_team_org_consistency;

with changed as (
  update public.teams t set created_by=null
  where t.created_by in (select user_id from cleanup_targets)
  returning 1
)
insert into cleanup_execution_log(phase,relation,affected)
select 2,'public.teams.created_by -> NULL',count(*) from changed;

alter table public.teams enable trigger trg_team_org_consistency;

-- Exclui linhas diretamente ligadas a profiles/auth, em fases. Constraints ficam ativas.
do $delete$
declare phase_no int; r record; n bigint; sql text;
begin
  for phase_no in 2..4 loop
    for r in
      select distinct ns.nspname s, src.relname t, a.attname col,
        rns.nspname rs, ref.relname rt, ra.attname rc
      from pg_constraint c
      join pg_class src on src.oid=c.conrelid join pg_namespace ns on ns.oid=src.relnamespace
      join pg_class ref on ref.oid=c.confrelid join pg_namespace rns on rns.oid=ref.relnamespace
      join lateral unnest(c.conkey,c.confkey) k(sa,ra) on true
      join pg_attribute a on a.attrelid=src.oid and a.attnum=k.sa
      join pg_attribute ra on ra.attrelid=ref.oid and ra.attnum=k.ra
      where c.contype='f' and not (ns.nspname='public' and src.relname='profiles')
        and not (ns.nspname='public' and src.relname='demandas' and a.attname='demandante')
        and not (ns.nspname='public' and src.relname='teams' and a.attname='created_by')
        and ((phase_no=2 and rns.nspname='public' and ref.relname='profiles' and ra.attname='id')
          or (phase_no=3 and rns.nspname='public' and ref.relname='profiles' and ra.attname='user_id')
          or (phase_no=4 and rns.nspname='auth' and ref.relname='users' and ra.attname='id'))
      order by ns.nspname,src.relname,a.attname
    loop
      sql := case when r.rs='public' and r.rc='id'
        then format('delete from %I.%I where %I in (select profile_id from cleanup_targets where profile_id is not null)',r.s,r.t,r.col)
        else format('delete from %I.%I where %I in (select user_id from cleanup_targets)',r.s,r.t,r.col) end;
      execute sql; get diagnostics n=row_count;
      insert into cleanup_execution_log(phase,relation,affected) values(phase_no,format('%I.%I.%I',r.s,r.t,r.col),n);
    end loop;
  end loop;
end $delete$;

with d as (delete from public.profiles p using cleanup_targets t where p.user_id=t.user_id returning 1)
insert into cleanup_execution_log(phase,relation,affected) select 5,'public.profiles',count(*) from d;
with d as (delete from auth.users u using cleanup_targets t where u.id=t.user_id returning 1)
insert into cleanup_execution_log(phase,relation,affected) select 6,'auth.users',count(*) from d;

-- ValidaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes antes de permitir commit.
do $validate$
declare n bigint;
begin
  select count(*) into n from auth.users u
  where not exists(select 1 from cleanup_whitelist w where w.email=lower(trim(u.email)));
  if n<>0 then raise exception 'Ainda existem % usuÃƒÆ’Ã‚Â¡rios fora da whitelist',n; end if;
  select count(*) into n from cleanup_whitelist w
  where (select count(*) from auth.users u where lower(trim(u.email))=w.email)<>1;
  if n<>0 then raise exception 'Whitelist corrompida apÃƒÆ’Ã‚Â³s deleÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o'; end if;
  select count(*) into n from public.profiles p left join auth.users u on u.id=p.user_id where u.id is null;
  if n<>0 then raise exception 'Existem % profiles ÃƒÆ’Ã‚Â³rfÃƒÆ’Ã‚Â£os',n; end if;
end $validate$;

select section, item, details
from (
  select 10 as section_order, 'EXECUTION_LOG'::text as section,
         relation as item,
         jsonb_build_object('phase',phase,'affected',affected,'executed_at',executed_at) as details
  from cleanup_execution_log
  union all
  select 20, 'REMAINING_USER', lower(email),
         jsonb_build_object('id',id,'created_at',created_at)
  from auth.users
) report
order by section_order, section, item;

rollback;
