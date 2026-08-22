begin;

create or replace function public.update_apf_dossier_draft(
  p_dossier_id uuid,
  p_dossier_code text,
  p_title text,
  p_counting_type text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dossier public.apf_evidence_dossiers%rowtype;
begin
  select * into v_dossier
  from public.apf_evidence_dossiers
  where id = p_dossier_id
  for update;

  if v_dossier.id is null then
    raise exception 'Dossiê não encontrado.' using errcode = 'P0002';
  end if;
  perform public.apf_assert_dossier_permission(p_dossier_id, 'apf.dossier.review');
  if v_dossier.status <> 'draft' then
    raise exception 'Somente dossiês em rascunho podem ser editados.' using errcode = '55000';
  end if;
  if nullif(trim(p_dossier_code), '') is null or nullif(trim(p_title), '') is null then
    raise exception 'Código e título são obrigatórios.' using errcode = '22023';
  end if;
  if p_counting_type not in ('project', 'impact', 'corrective', 'recount') then
    raise exception 'Tipo de contagem inválido.' using errcode = '22023';
  end if;

  update public.apf_evidence_dossiers
  set dossier_code = trim(p_dossier_code), title = trim(p_title), counting_type = p_counting_type
  where id = p_dossier_id;
end;
$$;

create or replace function public.apf_reject_immutable_version_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE'
     and current_setting('app.apf_draft_delete', true) = old.dossier_id::text then
    return old;
  end if;
  raise exception 'apf_dossier_version_is_immutable' using errcode = '55000';
end;
$$;

create or replace function public.delete_apf_dossier_draft(p_dossier_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dossier public.apf_evidence_dossiers%rowtype;
begin
  select * into v_dossier
  from public.apf_evidence_dossiers
  where id = p_dossier_id
  for update;

  if v_dossier.id is null then
    raise exception 'Dossiê não encontrado.' using errcode = 'P0002';
  end if;
  perform public.apf_assert_dossier_permission(p_dossier_id, 'apf.dossier.review');
  if v_dossier.status <> 'draft' then
    raise exception 'Somente dossiês em rascunho podem ser excluídos.' using errcode = '55000';
  end if;
  if exists (select 1 from public.apf_evidence_dossiers where previous_dossier_id = p_dossier_id) then
    raise exception 'O dossiê possui uma correção vinculada e não pode ser excluído.' using errcode = '23503';
  end if;

  perform set_config('app.apf_draft_delete', p_dossier_id::text, true);
  delete from public.apf_measurement_batch_dossiers where dossier_id = p_dossier_id;
  delete from public.apf_external_evidence_imports where dossier_id = p_dossier_id;
  delete from public.apf_dossier_events where dossier_id = p_dossier_id;
  delete from public.apf_dossier_versions where dossier_id = p_dossier_id;
  delete from public.apf_evidence_dossiers where id = p_dossier_id;
end;
$$;

revoke all on function public.update_apf_dossier_draft(uuid, text, text, text) from public, anon;
revoke all on function public.delete_apf_dossier_draft(uuid) from public, anon;
grant execute on function public.update_apf_dossier_draft(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.delete_apf_dossier_draft(uuid) to authenticated, service_role;

commit;
