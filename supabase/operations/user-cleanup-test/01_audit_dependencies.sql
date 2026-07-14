-- READ ONLY: inventário de identidades, FKs, referências prováveis e Storage.
-- Execute como postgres/service role no ambiente de TESTE.

-- PostgreSQL não permite CREATE TEMP TABLE dentro de uma transação READ ONLY.
-- A estrutura temporária é criada antes; nenhuma tabela persistente é alterada.
drop table if exists pg_temp.cleanup_whitelist;
create temp table cleanup_whitelist(email text primary key, expected_name text not null);

begin transaction read only;

insert into cleanup_whitelist values
  ('alissandra.teixeira@globalweb.com.br', 'Alissandra Oliveira'),
  ('edsonrj@globalweb.com.br', 'Edson Junior'),
  ('gabrielca@globalweb.com.br', 'Gabriel Almeida'),
  ('rafael.angelo@globalweb.com.br', 'Rafael Angelo'),
  ('rjoacina@gmail.com', 'JOACINA ANTUNES'),
  ('roberto.sales@gmail.com', 'Roberto Sales'),
  ('leidybsb@gmail.com', 'Leidy'),
  ('fatima.ferni@gmail.com', 'Fatima Ferni');

-- 1) Inventário completo de usuários e decisão keep/delete.
select u.id as user_id, lower(trim(u.email)) as email,
       coalesce(p.display_name, p.full_name, u.raw_user_meta_data->>'full_name',
                u.raw_user_meta_data->>'name') as observed_name,
       w.expected_name,
       case when w.email is null then 'DELETE' else 'KEEP' end as decision,
       u.created_at, u.last_sign_in_at, p.id as profile_id, p.is_active
from auth.users u
left join cleanup_whitelist w on w.email = lower(trim(u.email))
left join public.profiles p on p.user_id = u.id
order by decision desc, email, u.id;

-- 2) Integridade da whitelist. Qualquer status diferente de OK é BLOCKER.
select w.email, w.expected_name, count(u.id) as auth_matches,
       count(p.id) as profile_matches,
       case when count(u.id) = 1 then 'OK' else 'BLOCKER' end as status
from cleanup_whitelist w
left join auth.users u on lower(trim(u.email)) = w.email
left join public.profiles p on p.user_id = u.id
group by w.email, w.expected_name order by w.email;

-- 3) Todas as FKs que chegam a auth.users ou profiles, com ação de deleção.
select ns.nspname as source_schema, src.relname as source_table,
       a.attname as source_column, c.conname,
       rns.nspname as target_schema, ref.relname as target_table,
       ra.attname as target_column,
       case c.confdeltype when 'a' then 'NO ACTION' when 'r' then 'RESTRICT'
         when 'c' then 'CASCADE' when 'n' then 'SET NULL' when 'd' then 'SET DEFAULT' end as on_delete
from pg_constraint c
join pg_class src on src.oid = c.conrelid
join pg_namespace ns on ns.oid = src.relnamespace
join pg_class ref on ref.oid = c.confrelid
join pg_namespace rns on rns.oid = ref.relnamespace
join lateral unnest(c.conkey, c.confkey) with ordinality k(src_attnum, ref_attnum, ord) on true
join pg_attribute a on a.attrelid = src.oid and a.attnum = k.src_attnum
join pg_attribute ra on ra.attrelid = ref.oid and ra.attnum = k.ref_attnum
where c.contype = 'f'
  and ((rns.nspname = 'auth' and ref.relname = 'users')
    or (rns.nspname = 'public' and ref.relname = 'profiles'))
order by target_schema, target_table, source_schema, source_table, source_column;

-- 4) Grafo completo de FKs relacionado a tabelas que chegam à identidade.
with recursive roots(oid) as (
  select 'auth.users'::regclass union select 'public.profiles'::regclass
), graph(depth, parent_oid, child_oid, path) as (
  select 1, c.confrelid, c.conrelid, array[c.confrelid, c.conrelid]
  from pg_constraint c join roots r on r.oid = c.confrelid where c.contype = 'f'
  union all
  select g.depth + 1, c.confrelid, c.conrelid, g.path || c.conrelid
  from graph g join pg_constraint c on c.confrelid = g.child_oid and c.contype = 'f'
  where g.depth < 12 and not c.conrelid = any(g.path)
), dependency_graph as (
  select distinct depth, parent_oid::regclass as referenced_table,
         child_oid::regclass as dependent_table
  from graph
)
select depth, referenced_table, dependent_table
from dependency_graph
order by depth, referenced_table::text, dependent_table::text;

-- 5) Colunas de identidade/autoria potencialmente relacionadas, inclusive sem FK.
with fk_columns as (
  select c.conrelid, unnest(c.conkey) as attnum
  from pg_constraint c where c.contype = 'f'
)
select n.nspname as table_schema, cl.relname as table_name, a.attname as column_name,
       format_type(a.atttypid, a.atttypmod) as data_type,
       case when fk.attnum is null then 'REVIEW_NO_FK' else 'COVERED_BY_FK' end as coverage
from pg_attribute a
join pg_class cl on cl.oid = a.attrelid and cl.relkind in ('r','p')
join pg_namespace n on n.oid = cl.relnamespace
left join fk_columns fk on fk.conrelid = a.attrelid and fk.attnum = a.attnum
where a.attnum > 0 and not a.attisdropped
  and n.nspname not in ('pg_catalog','information_schema')
  and a.attname ~* '(^user_id$|profile_id$|assignee_id$|actor_id$|owner_id$|created_by$|updated_by$|generated_by$|responsavel|demandante|target_id$|subject_user_id$)'
order by coverage desc, table_schema, table_name, column_name;

-- 6) Buckets e objetos que parecem vinculados a usuários.
select b.id as bucket_id, b.name, b.public, count(o.id) as object_count
from storage.buckets b left join storage.objects o on o.bucket_id = b.id
group by b.id, b.name, b.public order by b.id;

select o.bucket_id, o.id, o.name, o.owner, o.created_at,
       u.id as matched_user_id, lower(u.email) as matched_email,
       case when w.email is null then 'DELETE_CANDIDATE' else 'KEEP' end as decision
from storage.objects o
join auth.users u on o.owner = u.id
  or split_part(o.name, '/', 1) = u.id::text
left join cleanup_whitelist w on w.email = lower(trim(u.email))
order by decision desc, o.bucket_id, o.name;

rollback;

drop table if exists pg_temp.cleanup_whitelist;
