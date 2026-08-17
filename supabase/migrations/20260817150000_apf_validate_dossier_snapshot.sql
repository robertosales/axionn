-- Atomically validates a dossier and persists its immutable document version.
create or replace function public.validate_apf_dossier_snapshot(
  p_dossier_id uuid,
  p_snapshot jsonb,
  p_rendered_markdown text,
  p_content_hash text,
  p_total_impacted_pf numeric
) returns table(version_number integer, content_hash text)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_dossier public.apf_evidence_dossiers%rowtype;
  v_version integer;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into v_dossier from public.apf_evidence_dossiers where id = p_dossier_id for update;
  if not found or not public.is_organization_member(v_dossier.organization_id, auth.uid()) then
    raise exception 'dossier_access_denied' using errcode = '42501';
  end if;
  if v_dossier.status in ('homologated', 'superseded', 'cancelled') then
    raise exception 'dossier_status_is_immutable' using errcode = '55000';
  end if;
  if nullif(trim(p_rendered_markdown), '') is null or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_dossier_document' using errcode = '22023';
  end if;
  select coalesce(max(v.version_number), 0) + 1 into v_version
  from public.apf_dossier_versions v where v.dossier_id = p_dossier_id;
  insert into public.apf_dossier_versions(dossier_id, version_number, snapshot, rendered_markdown, content_hash, created_by)
  values (p_dossier_id, v_version, p_snapshot, p_rendered_markdown, p_content_hash, auth.uid());
  update public.apf_evidence_dossiers set status = 'validated', validated_by = auth.uid(), validated_at = now(), total_impacted_pf = p_total_impacted_pf where id = p_dossier_id;
  insert into public.apf_dossier_events(dossier_id, event_type, actor_id, event_data)
  values (p_dossier_id, 'validated', auth.uid(), jsonb_build_object('version', v_version, 'content_hash', p_content_hash, 'total_impacted_pf', p_total_impacted_pf));
  return query select v_version, p_content_hash;
end;
$$;

revoke all on function public.validate_apf_dossier_snapshot(uuid, jsonb, text, text, numeric) from public, anon;
grant execute on function public.validate_apf_dossier_snapshot(uuid, jsonb, text, text, numeric) to authenticated, service_role;
