begin;
create or replace function public.validate_apf_dossier_snapshot(p_dossier_id uuid,p_snapshot jsonb,p_rendered_markdown text,p_content_hash text,p_total_impacted_pf numeric)returns table(version_number integer,content_hash text)language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.apf_evidence_dossiers%rowtype;v integer;calculated numeric;session_total numeric;
begin
 if auth.uid()is null then raise exception'authentication_required'using errcode='42501';end if;
 select*into d from public.apf_evidence_dossiers where id=p_dossier_id for update;
 if not found then raise exception'dossier_not_found'using errcode='P0002';end if;
 perform public.apf_assert_dossier_permission(p_dossier_id,'apf.dossier.validate');
 if d.status in('homologated','superseded','cancelled')then raise exception'dossier_status_is_immutable'using errcode='55000';end if;
 if d.counting_session_id is null or d.counting_model_id is null or d.ruleset_snapshot='{}'::jsonb then raise exception'ruleset_and_counting_session_must_be_frozen'using errcode='22023';end if;
 if nullif(trim(p_rendered_markdown),'')is null or p_content_hash!~'^[0-9a-f]{64}$'or encode(digest(convert_to(p_rendered_markdown,'UTF8'),'sha256'),'hex')<>p_content_hash then raise exception'invalid_dossier_document_or_hash'using errcode='22023';end if;
 if not exists(select 1 from public.apf_acceptance_criteria where dossier_id=p_dossier_id)or exists(select 1 from public.apf_acceptance_criteria where dossier_id=p_dossier_id and decision is null)then raise exception'all_acceptance_criteria_require_decision'using errcode='22023';end if;
 if exists(select 1 from public.apf_acceptance_criteria c where c.dossier_id=p_dossier_id and c.decision in('meets','partially_meets')and not exists(select 1 from public.apf_traceability_links l join public.apf_evidence_sources e on e.id=l.evidence_source_id and e.dossier_id=p_dossier_id where l.acceptance_criterion_id=c.id and l.confirmed_by is not null and l.functional_result<>'pending'and e.verification_status='verified'))then raise exception'positive_criterion_requires_confirmed_verified_evidence'using errcode='22023';end if;
 if exists(select 1 from public.apf_counting_items i where i.session_id=d.counting_session_id and i.counting_decision='counted'and(not i.is_validated or(nullif(trim(i.evidence_literal),'')is null and not exists(select 1 from public.apf_traceability_links l where l.dossier_id=p_dossier_id and l.counting_item_id=i.id))))then raise exception'counted_items_require_validation_and_evidence'using errcode='22023';end if;
 if exists(select 1 from public.apf_counting_items i where i.session_id=d.counting_session_id and(i.corrected_function_sigla is not null or i.corrected_factor_sigla is not null or i.corrected_pf_bruto is not null or i.corrected_pf_fs is not null)and nullif(trim(i.justification),'')is null)then raise exception'counting_overrides_require_justification'using errcode='22023';end if;
 select coalesce(sum(case when counting_decision='counted'then coalesce(corrected_pf_fs,pf_fs)else 0 end),0)into calculated from public.apf_counting_items where session_id=d.counting_session_id;
 select total_pf_fs into session_total from public.apf_counting_sessions where id=d.counting_session_id;
 if abs(calculated-p_total_impacted_pf)>.0001 or abs(coalesce(session_total,0)-p_total_impacted_pf)>.0001 then raise exception'calculation_memory_does_not_close'using errcode='22023';end if;
 select coalesce(max(x.version_number),0)+1 into v from public.apf_dossier_versions x where x.dossier_id=p_dossier_id;
 insert into public.apf_dossier_versions(dossier_id,version_number,snapshot,rendered_markdown,content_hash,created_by)values(p_dossier_id,v,p_snapshot,p_rendered_markdown,p_content_hash,auth.uid());
 update public.apf_evidence_dossiers set status='validated',validated_by=auth.uid(),validated_at=now(),total_impacted_pf=p_total_impacted_pf where id=p_dossier_id;
 insert into public.apf_dossier_events(dossier_id,event_type,actor_id,event_data)values(p_dossier_id,'validated',auth.uid(),jsonb_build_object('version',v,'content_hash',p_content_hash,'total_impacted_pf',p_total_impacted_pf,'readiness_gate','server_v2'));
 return query select v,p_content_hash;
end $$;
commit;
