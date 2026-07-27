-- OKR V2 - serializa as transicoes criticas do fechamento de ciclo.
-- Migration aditiva: substitui somente as RPCs afetadas, preservando assinaturas.

begin;

create or replace function public.start_okr_cycle_closing_v1(p_cycle_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.okr_cycles;
begin
  select *
    into v_row
    from public.okr_cycles
   where id = p_cycle_id
   for update;

  if v_row.id is null then
    raise exception 'OKR_CYCLE_NOT_FOUND' using errcode = '02000';
  end if;

  perform public._okr_v2_guard(
    v_row.organization_id,
    'okr.close_cycle',
    'okr.cycle_management'
  );

  if v_row.status <> 'active' then
    raise exception
      'OKR_CYCLE_INVALID_TRANSITION: start_closing requires active (current=%)',
      v_row.status
      using errcode = '55000';
  end if;

  update public.okr_cycles
     set status = 'closing',
         closing_started_at = now(),
         closing_started_by = auth.uid(),
         updated_by = auth.uid()
   where id = p_cycle_id
     and status = 'active';

  if not found then
    raise exception 'OKR_CYCLE_CONCURRENT_TRANSITION'
      using errcode = '40001';
  end if;

  insert into public.okr_audit_log(action, actor_id, metadata)
  values (
    'cycle_closing_started',
    auth.uid(),
    jsonb_build_object('cycle_id', p_cycle_id)
  );
end;
$$;

create or replace function public.close_okr_cycle_v1(p_cycle_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.okr_cycles;
  v_open integer;
begin
  select *
    into v_row
    from public.okr_cycles
   where id = p_cycle_id
   for update;

  if v_row.id is null then
    raise exception 'OKR_CYCLE_NOT_FOUND' using errcode = '02000';
  end if;

  perform public._okr_v2_guard(
    v_row.organization_id,
    'okr.close_cycle',
    'okr.cycle_management'
  );

  if v_row.status <> 'closing' then
    raise exception
      'OKR_CYCLE_INVALID_TRANSITION: close requires closing (current=%)',
      v_row.status
      using errcode = '55000';
  end if;

  select count(*)
    into v_open
    from public.okr_objectives
   where cycle_id = p_cycle_id
     and coalesce(lifecycle_status, 'active')
         in ('active', 'under_review', 'paused');

  if v_open > 0 then
    raise exception 'OKR_CYCLE_HAS_OPEN_OBJECTIVES: % em aberto', v_open
      using errcode = '55000';
  end if;

  update public.okr_cycles
     set status = 'closed',
         closed_at = now(),
         closed_by = auth.uid(),
         updated_by = auth.uid()
   where id = p_cycle_id
     and status = 'closing';

  if not found then
    raise exception 'OKR_CYCLE_CONCURRENT_TRANSITION'
      using errcode = '40001';
  end if;

  insert into public.okr_audit_log(action, actor_id, metadata)
  values (
    'cycle_closed',
    auth.uid(),
    jsonb_build_object('cycle_id', p_cycle_id)
  );
end;
$$;

revoke all on function public.start_okr_cycle_closing_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.close_okr_cycle_v1(uuid)
  from public, anon, authenticated;

grant execute on function public.start_okr_cycle_closing_v1(uuid)
  to authenticated, service_role;
grant execute on function public.close_okr_cycle_v1(uuid)
  to authenticated, service_role;

comment on function public.start_okr_cycle_closing_v1(uuid) is
  'Inicia fechamento com lock pessimista e transicao condicional.';
comment on function public.close_okr_cycle_v1(uuid) is
  'Fecha ciclo com lock pessimista, validacao de objetivos e transicao condicional.';

commit;
