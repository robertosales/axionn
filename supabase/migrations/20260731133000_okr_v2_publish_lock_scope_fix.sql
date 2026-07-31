-- OKR V2 - restringe o lock da publicação ao objetivo.
--
-- PostgreSQL não permite FOR UPDATE irrestrito quando a consulta contém um
-- LEFT JOIN, pois isso tentaria bloquear também o lado anulável. O ciclo é
-- somente consultado; apenas a linha do objetivo precisa ser bloqueada.

begin;

create or replace function public.publish_okr_objective_v2(
  p_org_id uuid,
  p_objective_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_lifecycle text;
  v_org uuid;
  v_cycle_status text;
  v_kr_count integer;
begin
  perform public._okr_v2_guard(p_org_id, 'okr.edit');

  select o.organization_id, o.owner_id, o.lifecycle_status, c.status
    into v_org, v_owner, v_lifecycle, v_cycle_status
  from public.okr_objectives o
  left join public.okr_cycles c on c.id = o.cycle_id
  where o.id = p_objective_id
  for update of o;

  if v_org is null or v_org <> p_org_id then
    raise exception 'OKR_V2_OBJECTIVE_NOT_FOUND' using errcode = '22023';
  end if;
  if v_lifecycle not in ('draft', 'ready') then
    raise exception 'OKR_V2_OBJECTIVE_ALREADY_PUBLISHED: %', v_lifecycle
      using errcode = '22023';
  end if;
  if v_owner is null then
    raise exception 'OKR_V2_OWNER_REQUIRED_FOR_PUBLISH'
      using errcode = '22023';
  end if;
  if v_cycle_status not in ('planning', 'active') then
    raise exception 'OKR_V2_CYCLE_NOT_OPEN: %', v_cycle_status
      using errcode = '22023';
  end if;

  select count(*)
    into v_kr_count
  from public.okr_key_results
  where objective_id = p_objective_id
    and lifecycle_status = 'active';

  if v_kr_count = 0 then
    raise exception 'OKR_V2_PUBLISH_REQUIRES_KR' using errcode = '22023';
  end if;

  update public.okr_objectives
  set lifecycle_status = 'active',
      published_at = now(),
      published_by = auth.uid(),
      lock_version = lock_version + 1,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_objective_id;

  insert into public.okr_audit_log
    (objective_id, actor_id, action, metadata, created_at)
  values
    (p_objective_id, auth.uid(), 'objective.published', '{}'::jsonb, now())
  on conflict do nothing;

  return p_objective_id;
end;
$$;

revoke all on function public.publish_okr_objective_v2(uuid, uuid)
  from public, anon;
grant execute on function public.publish_okr_objective_v2(uuid, uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
