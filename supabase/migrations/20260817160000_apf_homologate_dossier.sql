-- Homologation is a distinct, irreversible approval over an existing version.
create or replace function public.homologate_apf_dossier(
  p_dossier_id uuid,
  p_version_number integer
) returns table(version_number integer, content_hash text, homologated_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_dossier public.apf_evidence_dossiers%rowtype;
  v_version public.apf_dossier_versions%rowtype;
  v_homologated_at timestamptz := now();
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into v_dossier from public.apf_evidence_dossiers where id = p_dossier_id for update;
  if not found or not public.is_organization_member(v_dossier.organization_id, auth.uid()) then
    raise exception 'dossier_access_denied' using errcode = '42501';
  end if;
  if v_dossier.status <> 'validated' then
    raise exception 'dossier_must_be_validated' using errcode = '55000';
  end if;
  if auth.uid() = v_dossier.created_by or auth.uid() = v_dossier.validated_by then
    raise exception 'dossier_homologation_requires_distinct_user' using errcode = '42501';
  end if;
  select * into v_version from public.apf_dossier_versions
  where dossier_id = p_dossier_id and apf_dossier_versions.version_number = p_version_number;
  if not found then raise exception 'dossier_version_not_found' using errcode = 'P0002'; end if;
  if p_version_number <> (select max(candidate.version_number) from public.apf_dossier_versions candidate where candidate.dossier_id = p_dossier_id) then
    raise exception 'only_latest_dossier_version_can_be_homologated' using errcode = '55000';
  end if;
  update public.apf_evidence_dossiers set status = 'homologated', homologated_by = auth.uid(), homologated_at = v_homologated_at, total_homologated_pf = total_impacted_pf where id = p_dossier_id;
  insert into public.apf_dossier_events(dossier_id, event_type, actor_id, event_data)
  values (p_dossier_id, 'homologated', auth.uid(), jsonb_build_object('version', p_version_number, 'content_hash', v_version.content_hash, 'total_homologated_pf', v_dossier.total_impacted_pf));
  return query select p_version_number, v_version.content_hash, v_homologated_at;
end;
$$;

revoke all on function public.homologate_apf_dossier(uuid, integer) from public, anon;
grant execute on function public.homologate_apf_dossier(uuid, integer) to authenticated, service_role;
