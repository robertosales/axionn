-- OKR Entitlement enforcement no backend
-- Executar exclusivamente pelo Lovable
begin;

-- 1. Adicionar verificação de entitlement em set_okr_health_override (okr.edit)
create or replace function public.set_okr_health_override(p_objective_id uuid, p_health text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_objective public.okr_objectives%rowtype; v_org_id uuid; v_allowed boolean;
begin
  select * into v_objective from public.okr_objectives where id = p_objective_id;
  if v_objective.id is null then raise exception 'Objetivo não encontrado'; end if;
  if not (public.is_admin() or public.is_team_member(auth.uid(), v_objective.team_id)) then raise exception 'Acesso negado'; end if;
  if p_health is not null and p_health not in ('on_track','attention','at_risk','no_data','completed') then raise exception 'Saúde inválida'; end if;
  if p_health is not null and nullif(trim(p_reason), '') is null then raise exception 'Justificativa obrigatória'; end if;

  -- Verificar entitlement okr.edit
  select teams.org_id into v_org_id from public.teams where teams.id = v_objective.team_id;
  if v_org_id is not null then
    select public.has_organization_entitlement(v_org_id, 'okr.edit') into v_allowed;
    if not v_allowed then raise exception 'Entitlement negado: okr.edit não incluído no plano atual'; end if;
  end if;

  update public.okr_objectives set
    manual_health_override = p_health,
    health_override_reason = case when p_health is null then null else trim(p_reason) end,
    health_override_by = case when p_health is null then null else auth.uid() end,
    health_override_at = case when p_health is null then null else now() end,
    updated_by = auth.uid(), updated_at = now()
  where id = p_objective_id;
  insert into public.okr_audit_log(objective_id, action, actor_id, before_data, after_data)
  values (p_objective_id, 'health_override', auth.uid(),
    jsonb_build_object('health', v_objective.manual_health_override, 'reason', v_objective.health_override_reason),
    jsonb_build_object('health', p_health, 'reason', case when p_health is null then null else trim(p_reason) end));
end $$;

revoke all on function public.set_okr_health_override(uuid,text,text) from public;
grant execute on function public.set_okr_health_override(uuid,text,text) to authenticated;

-- 2. Trigger de enforcement para insert/update em okr_objectives (okr.create, okr.edit)
create or replace function public.enforce_okr_objective_entitlement()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org_id uuid; v_feature text; v_allowed boolean;
begin
  if tg_op = 'INSERT' then v_feature := 'okr.create'; else v_feature := 'okr.edit'; end if;
  select teams.org_id into v_org_id from public.teams where teams.id = new.team_id;
  if v_org_id is not null then
    select public.has_organization_entitlement(v_org_id, v_feature) into v_allowed;
    if not v_allowed then raise exception 'Entitlement negado: % não incluído no plano atual', v_feature; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_okr_objective_entitlement on public.okr_objectives;
create trigger trg_enforce_okr_objective_entitlement
before insert or update on public.okr_objectives
for each row execute function public.enforce_okr_objective_entitlement();

-- 3. Trigger de enforcement para insert/update em okr_key_results (okr.create, okr.edit)
create or replace function public.enforce_okr_key_result_entitlement()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org_id uuid; v_feature text; v_allowed boolean; v_objective public.okr_objectives%rowtype;
begin
  if tg_op = 'INSERT' then v_feature := 'okr.create'; else v_feature := 'okr.edit'; end if;
  select * into v_objective from public.okr_objectives where id = new.objective_id;
  select teams.org_id into v_org_id from public.teams where teams.id = v_objective.team_id;
  if v_org_id is not null then
    select public.has_organization_entitlement(v_org_id, v_feature) into v_allowed;
    if not v_allowed then raise exception 'Entitlement negado: % não incluído no plano atual', v_feature; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_okr_key_result_entitlement on public.okr_key_results;
create trigger trg_enforce_okr_key_result_entitlement
before insert or update on public.okr_key_results
for each row execute function public.enforce_okr_key_result_entitlement();

-- 4. Trigger de enforcement para insert em okr_check_ins (okr.check_in)
create or replace function public.enforce_okr_check_in_entitlement()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org_id uuid; v_allowed boolean; v_kr public.okr_key_results%rowtype; v_objective public.okr_objectives%rowtype;
begin
  select * into v_kr from public.okr_key_results where id = new.key_result_id;
  select * into v_objective from public.okr_objectives where id = v_kr.objective_id;
  select teams.org_id into v_org_id from public.teams where teams.id = v_objective.team_id;
  if v_org_id is not null then
    select public.has_organization_entitlement(v_org_id, 'okr.check_in') into v_allowed;
    if not v_allowed then raise exception 'Entitlement negado: okr.check_in não incluído no plano atual'; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_okr_check_in_entitlement on public.okr_check_ins;
create trigger trg_enforce_okr_check_in_entitlement
before insert on public.okr_check_ins
for each row execute function public.enforce_okr_check_in_entitlement();

-- 5. Trigger de enforcement para insert/update em okr_initiatives (okr.initiatives)
create or replace function public.enforce_okr_initiative_entitlement()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org_id uuid; v_allowed boolean; v_objective public.okr_objectives%rowtype;
begin
  select * into v_objective from public.okr_objectives where id = new.objective_id;
  select teams.org_id into v_org_id from public.teams where teams.id = v_objective.team_id;
  if v_org_id is not null then
    select public.has_organization_entitlement(v_org_id, 'okr.initiatives') into v_allowed;
    if not v_allowed then raise exception 'Entitlement negado: okr.initiatives não incluído no plano atual'; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_okr_initiative_entitlement on public.okr_initiatives;
create trigger trg_enforce_okr_initiative_entitlement
before insert or update on public.okr_initiatives
for each row execute function public.enforce_okr_initiative_entitlement();

comment on function public.enforce_okr_objective_entitlement is 'Valida entitlement okr.create/edit antes de criar/atualizar objetivo';
comment on function public.enforce_okr_key_result_entitlement is 'Valida entitlement okr.create/edit antes de criar/atualizar key result';
comment on function public.enforce_okr_check_in_entitlement is 'Valida entitlement okr.check_in antes de criar check-in';
comment on function public.enforce_okr_initiative_entitlement is 'Valida entitlement okr.initiatives antes de criar/atualizar iniciativa';

commit;