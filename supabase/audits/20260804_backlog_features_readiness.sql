-- Auditoria read-only para rollout da hierarquia Epic -> Feature -> User Story.

select
  to_regclass('public.backlog_features') is not null as table_ready,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_stories' and column_name = 'feature_id'
  ) as story_link_ready,
  (select relrowsecurity from pg_class where oid = to_regclass('public.backlog_features')) as rls_enabled;

select
  count(*) filter (where us.feature_id is not null) as classified_stories,
  count(*) filter (where us.feature_id is null and us.epic_id is not null) as legacy_epic_stories,
  count(*) filter (where us.feature_id is null and us.epic_id is null) as unclassified_stories
from public.user_stories us;

select
  count(*) as hierarchy_mismatches
from public.user_stories us
join public.backlog_features bf on bf.id = us.feature_id
where us.team_id <> bf.team_id or us.epic_id is distinct from bf.epic_id;

select
  bf.id,
  bf.name,
  count(us.id) as linked_stories
from public.backlog_features bf
left join public.user_stories us on us.feature_id = bf.id
group by bf.id, bf.name
order by linked_stories desc, bf.name;
