-- READ ONLY: materializa o conjunto-alvo e mostra contagens/amostras exatas.
-- Não contém DELETE/UPDATE/TRUNCATE.

-- PostgreSQL não permite CREATE TEMP TABLE dentro de uma transação READ ONLY.
-- Criamos somente as estruturas temporárias antes de ativar READ ONLY.
drop table if exists pg_temp.cleanup_whitelist;
drop table if exists pg_temp.cleanup_targets;
drop table if exists pg_temp.cleanup_manifest;
drop table if exists pg_temp.cleanup_blockers;
drop table if exists pg_temp.cleanup_personal_policy;
drop table if exists pg_temp.cleanup_planned_personal;

create temp table cleanup_whitelist(email text primary key);
create temp table cleanup_targets(user_id uuid, email text, profile_id uuid);
create temp table cleanup_manifest(
  phase int, source_schema text, source_table text, source_column text,
  identity_kind text, on_delete text, matched_rows bigint, sample_rows jsonb
);
create temp table cleanup_blockers(
  table_schema text, table_name text, column_name text, matched_rows bigint
);
create temp table cleanup_personal_policy(
  table_schema text, table_name text, column_name text,
  action text not null check (action in ('DELETE_ROW')),
  primary key (table_schema, table_name, column_name)
);
create temp table cleanup_planned_personal(
  table_schema text, table_name text, column_name text,
  action text, matched_rows bigint
);

begin transaction read only;

insert into cleanup_whitelist values
 ('alissandra.teixeira@globalweb.com.br'), ('edsonrj@globalweb.com.br'),
 ('gabrielca@globalweb.com.br'), ('rafael.angelo@globalweb.com.br'),
 ('rjoacina@gmail.com'), ('roberto.sales@gmail.com'),
 ('leidybsb@gmail.com'), ('fatima.ferni@gmail.com');

-- Política aprovada: registros pessoais/históricos/logs/backups são excluídos.
insert into cleanup_personal_policy values
 ('public','_backup_demanda_hours_p5','user_id','DELETE_ROW'),
 ('public','calendar_events','user_id','DELETE_ROW'),
 ('public','demanda_eventos','user_id','DELETE_ROW'),
 ('public','demanda_evidencias','user_id','DELETE_ROW'),
 ('public','demanda_hours_backup_20260511','user_id','DELETE_ROW'),
 ('public','demanda_hours_backup_minutos','user_id','DELETE_ROW'),
 ('public','demanda_hours','user_id','DELETE_ROW'),
 ('public','demanda_transitions','user_id','DELETE_ROW'),
 ('public','migration_demanda_hours_log','user_id','DELETE_ROW'),
 ('public','notifications','user_id','DELETE_ROW'),
 ('public','organization_membership_audit_log','subject_user_id','DELETE_ROW'),
 ('public','planning_participants','user_id','DELETE_ROW'),
 ('public','planning_votes','user_id','DELETE_ROW'),
 ('public','platform_user_roles','user_id','DELETE_ROW');

insert into cleanup_targets(user_id, email, profile_id)
select u.id as user_id, lower(trim(u.email)) as email, p.id as profile_id
from auth.users u left join public.profiles p on p.user_id = u.id
where not exists (select 1 from cleanup_whitelist w where w.email = lower(trim(u.email)));

-- Guardrail/fingerprint: copiar estes dois valores para o script final.
select count(*)::bigint as target_count,
       md5(coalesce(string_agg(user_id::text, ',' order by user_id), '')) as target_md5
from cleanup_targets;

select * from cleanup_targets order by email, user_id;

do $dry$
declare r record; v_count bigint; v_sample jsonb; v_pred text;
begin
  for r in
    select ns.nspname source_schema, src.relname source_table, a.attname source_column,
           rns.nspname target_schema, ref.relname target_table, ra.attname target_column,
           case c.confdeltype when 'a' then 'NO ACTION' when 'r' then 'RESTRICT'
             when 'c' then 'CASCADE' when 'n' then 'SET NULL' when 'd' then 'SET DEFAULT' end on_delete
    from pg_constraint c
    join pg_class src on src.oid=c.conrelid join pg_namespace ns on ns.oid=src.relnamespace
    join pg_class ref on ref.oid=c.confrelid join pg_namespace rns on rns.oid=ref.relnamespace
    join lateral unnest(c.conkey,c.confkey) k(sa,ra) on true
    join pg_attribute a on a.attrelid=src.oid and a.attnum=k.sa
    join pg_attribute ra on ra.attrelid=ref.oid and ra.attnum=k.ra
    where c.contype='f' and ((rns.nspname='auth' and ref.relname='users' and ra.attname='id')
      or (rns.nspname='public' and ref.relname='profiles' and ra.attname in ('id','user_id')))
  loop
    v_pred := case when r.target_schema='auth' then
      format('%I in (select user_id from cleanup_targets)',r.source_column)
      when r.target_column='id' then format('%I in (select profile_id from cleanup_targets where profile_id is not null)',r.source_column)
      else format('%I in (select user_id from cleanup_targets)',r.source_column) end;
    execute format('select count(*), coalesce(jsonb_agg(x),''[]''::jsonb) from (select to_jsonb(t) x from %I.%I t where %s limit 20) s',
                   r.source_schema,r.source_table,v_pred) into v_count,v_sample;
    execute format('select count(*) from %I.%I where %s',r.source_schema,r.source_table,v_pred) into v_count;
    insert into cleanup_manifest values
      (case when r.target_schema='public' and r.target_column='id' then 2
            when r.target_schema='public' then 3 else 4 end,
       r.source_schema,r.source_table,r.source_column,
       r.target_schema||'.'||r.target_table||'.'||r.target_column,r.on_delete,v_count,v_sample);
  end loop;
end $dry$;

-- Manifesto exato de linhas diretamente vinculadas (amostra máxima de 20 por vínculo).
select * from cleanup_manifest order by phase, source_schema, source_table, source_column;

-- Totais por domínios pedidos (o manifesto detalhado continua sendo a autoridade).
select case
  when source_table ~* '(team|member)' then 'times/memberships'
  when source_table ~* 'contract' then 'contratos'
  when source_table ~* 'activit' then 'atividades'
  when source_table ~* '(user_stor|stories)' then 'user_stories'
  when source_table ~* '(link|integration)' then 'links/integracoes'
  when source_table ~* '(role|permission|access|admin)' then 'permissoes'
  when source_table ~* '(log|audit|event|history)' then 'logs/auditoria'
  else 'outras' end as domain,
  sum(matched_rows) as direct_matches
from cleanup_manifest group by 1 order by 1;

-- Objetos de Storage a remover.
select o.bucket_id, o.id, o.name, o.owner, o.created_at
from storage.objects o join cleanup_targets t
  on o.owner=t.user_id or split_part(o.name,'/',1)=t.user_id::text
order by o.bucket_id,o.name;

-- BLOCKERS: UUIDs-alvo encontrados em colunas sugestivas sem FK.
do $block$
declare r record; n bigint; planned_action text;
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
      and not exists (select 1 from pg_constraint c where c.contype='f' and c.conrelid=cl.oid and a.attnum=any(c.conkey))
  loop
    execute format('select count(*) from %I.%I where %I in (select user_id from cleanup_targets union select profile_id from cleanup_targets where profile_id is not null)',r.s,r.t,r.c) into n;
    if n>0 then
      select p.action into planned_action from cleanup_personal_policy p
      where p.table_schema=r.s and p.table_name=r.t and p.column_name=r.c;
      if planned_action is null then
        insert into cleanup_blockers values(r.s,r.t,r.c,n);
      else
        insert into cleanup_planned_personal values(r.s,r.t,r.c,planned_action,n);
      end if;
    end if;
  end loop;
end $block$;
select *, 'BLOCKER_REVIEW_REQUIRED' as status from cleanup_blockers order by 1,2,3;

select *, 'APPROVED_PERSONAL_DATA_REMOVAL' as status
from cleanup_planned_personal order by 1,2,3;

-- Whitelist precisa continuar íntegra no instante do dry-run.
select w.email, count(u.id) auth_matches,
       case when count(u.id)=1 then 'OK' else 'BLOCKER' end status
from cleanup_whitelist w left join auth.users u on lower(trim(u.email))=w.email
group by w.email order by w.email;

-- Relatório consolidado: este é o último result set e pode ser exportado em um
-- único CSV pelo Supabase SQL Editor.
with consolidated_report as (
  select 10 as section_order, 'FINGERPRINT'::text as section,
         'target_set'::text as item,
         jsonb_build_object(
           'target_count', count(*),
           'target_md5', md5(coalesce(string_agg(user_id::text, ',' order by user_id), ''))
         ) as details
  from cleanup_targets

  union all
  select 20, 'TARGET_USER', t.email,
         jsonb_build_object('user_id', t.user_id, 'profile_id', t.profile_id)
  from cleanup_targets t

  union all
  select 30, 'DEPENDENCY',
         format('%I.%I.%I', m.source_schema, m.source_table, m.source_column),
         jsonb_build_object(
           'phase', m.phase,
           'identity_kind', m.identity_kind,
           'on_delete', m.on_delete,
           'matched_rows', m.matched_rows,
           'sample_rows', m.sample_rows
         )
  from cleanup_manifest m

  union all
  select 40, 'STORAGE_OBJECT', o.bucket_id || '/' || o.name,
         jsonb_build_object('id', o.id, 'owner', o.owner, 'created_at', o.created_at)
  from storage.objects o
  join cleanup_targets t
    on o.owner=t.user_id or split_part(o.name,'/',1)=t.user_id::text

  union all
  select 45, 'PLANNED_PERSONAL_DELETE',
         format('%I.%I.%I', p.table_schema, p.table_name, p.column_name),
         jsonb_build_object('matched_rows', p.matched_rows, 'action', p.action)
  from cleanup_planned_personal p

  union all
  select 50, 'BLOCKER',
         format('%I.%I.%I', b.table_schema, b.table_name, b.column_name),
         jsonb_build_object('matched_rows', b.matched_rows,
                            'status', 'BLOCKER_REVIEW_REQUIRED')
  from cleanup_blockers b

  union all
  select 60, 'WHITELIST', w.email,
         jsonb_build_object(
           'auth_matches', count(u.id),
           'status', case when count(u.id)=1 then 'OK' else 'BLOCKER' end
         )
  from cleanup_whitelist w
  left join auth.users u on lower(trim(u.email))=w.email
  group by w.email
)
select section, item, details
from consolidated_report
order by section_order, item;

rollback;

drop table if exists pg_temp.cleanup_blockers;
drop table if exists pg_temp.cleanup_manifest;
drop table if exists pg_temp.cleanup_targets;
drop table if exists pg_temp.cleanup_whitelist;
drop table if exists pg_temp.cleanup_planned_personal;
drop table if exists pg_temp.cleanup_personal_policy;
