-- OKR V2: corrige a ordem dos argumentos do helper de membership.
-- A assinatura canonica e is_organization_member(organization_id, user_id).

begin;

create or replace function public.has_okr_permission_v2(
  _user_id uuid,
  _permission text,
  _org_id uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_member boolean := false;
  v_has_role boolean := false;
begin
  if _user_id is null or _permission is null or _org_id is null then
    return false;
  end if;

  select public.is_organization_member(_org_id, _user_id)
    into v_is_member;

  if not v_is_member then
    return false;
  end if;

  select exists (
    select 1
    from public.user_roles ur
    join public.team_members tm on tm.user_id = ur.user_id
    join public.teams t on t.id = tm.team_id
    join public.role_permissions rp on rp.role_name = ur.role::text
    where ur.user_id = _user_id
      and rp.permission_key = _permission
      and coalesce(t.org_id, public.resolve_team_org_id(t.id)) = _org_id
  ) into v_has_role;

  return v_has_role;
end;
$$;

create or replace function public.list_okr_cycles_v1(
  p_org_id uuid
) returns table(
  id uuid,
  code text,
  name text,
  cycle_type text,
  status text,
  starts_at date,
  ends_at date,
  timezone text,
  check_in_frequency text,
  scoring_method text,
  published_at timestamptz,
  closed_at timestamptz,
  archived_at timestamptz,
  objectives_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_organization_member(p_org_id, auth.uid()) then
    raise exception 'OKR_V2_FORBIDDEN' using errcode = '42501';
  end if;

  return query
    select
      c.id,
      c.code,
      c.name,
      c.cycle_type,
      c.status,
      c.starts_at,
      c.ends_at,
      c.timezone,
      c.check_in_frequency,
      c.scoring_method,
      c.published_at,
      c.closed_at,
      c.archived_at,
      (
        select count(*)
        from public.okr_objectives o
        where o.cycle_id = c.id
      ),
      c.created_at,
      c.updated_at
    from public.okr_cycles c
    where c.organization_id = p_org_id
    order by c.starts_at desc, c.created_at desc;
end;
$$;

drop policy if exists okr_cycles_org_member_select on public.okr_cycles;
create policy okr_cycles_org_member_select
  on public.okr_cycles
  for select
  to authenticated
  using (public.is_organization_member(organization_id, auth.uid()));

drop policy if exists okr_alignments_select on public.okr_objective_alignments;
create policy okr_alignments_select
  on public.okr_objective_alignments
  for select
  to authenticated
  using (public.is_organization_member(organization_id, auth.uid()));

revoke all on function public.has_okr_permission_v2(uuid, text, uuid)
  from public, anon;
grant execute on function public.has_okr_permission_v2(uuid, text, uuid)
  to authenticated, service_role;

revoke all on function public.list_okr_cycles_v1(uuid)
  from public, anon;
grant execute on function public.list_okr_cycles_v1(uuid)
  to authenticated, service_role;

comment on function public.has_okr_permission_v2(uuid, text, uuid) is
  'Valida membership canonica (org, usuario) e permissao OKR por role/time.';

notify pgrst, 'reload schema';

commit;
