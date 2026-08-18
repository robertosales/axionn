create table public.apf_evidence_quality_assessments(
 id uuid primary key default gen_random_uuid(),dossier_id uuid not null references public.apf_evidence_dossiers(id) on delete cascade,evidence_source_id uuid not null references public.apf_evidence_sources(id) on delete cascade,
 quality_score numeric(5,4) not null check(quality_score between 0 and 1),quality_grade text not null check(quality_grade in('strong','adequate','weak')),
 checks jsonb not null,assessed_at timestamptz not null default now(),unique(dossier_id,evidence_source_id)
);
alter table public.apf_evidence_quality_assessments enable row level security;
create policy apf_evidence_quality_select on public.apf_evidence_quality_assessments for select to authenticated using(public.apf_can_access_dossier(dossier_id));

create or replace function public.assess_apf_evidence_quality(p_dossier_id uuid)returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
 if auth.uid() is null or not public.apf_can_access_dossier(p_dossier_id)then raise exception 'Acesso negado.' using errcode='42501';end if;
 insert into public.apf_evidence_quality_assessments(dossier_id,evidence_source_id,quality_score,quality_grade,checks)
 select p_dossier_id,e.id,s.score,case when s.score>=.8 then'strong' when s.score>=.6 then'adequate' else'weak'end,
 jsonb_build_object('verified',e.verification_status='verified','has_hash',e.content_hash is not null,'has_permanent_url',e.permanent_url is not null,'has_repository',e.repository is not null,'has_provenance',e.metadata?'provider')
 from public.apf_evidence_sources e cross join lateral(select(case when e.verification_status='verified'then .35 else 0 end+case when e.content_hash is not null then .20 else 0 end+case when e.permanent_url is not null then .15 else 0 end+case when e.repository is not null then .15 else 0 end+case when e.metadata?'provider'then .15 else 0 end)::numeric score)s where e.dossier_id=p_dossier_id
 on conflict(dossier_id,evidence_source_id)do update set quality_score=excluded.quality_score,quality_grade=excluded.quality_grade,checks=excluded.checks,assessed_at=now();
 update public.apf_audit_findings set status='resolved',resolution_note='Não detectado na avaliação mais recente.',reviewed_at=now()where dossier_id=p_dossier_id and status='open'and finding_type in('weak_evidence','criterion_claim_without_verified_evidence','implementation_without_requirement');
 with f as(
 select'quality:'||q.evidence_source_id fingerprint,'weak_evidence' finding_type,'warning' severity,'Evidência com qualidade fraca'title,coalesce(c.stable_id,q.evidence_source_id::text)||' não possui garantias suficientes de proveniência e imutabilidade.'detail,'evidence_source'entity_type,q.evidence_source_id entity_id from public.apf_evidence_quality_assessments q left join public.apf_evidence_catalog_entries c on c.evidence_source_id=q.evidence_source_id and c.dossier_id=q.dossier_id where q.dossier_id=p_dossier_id and q.quality_grade='weak'
 union all select'claim:'||a.id,'criterion_claim_without_verified_evidence','critical','Atendimento sem prova verificada',a.stable_id||' está decidido como atendido, mas não possui evidência verificada.','acceptance_criterion',a.id from public.apf_acceptance_criteria a where a.dossier_id=p_dossier_id and a.decision in('meets','partially_meets')and not exists(select 1 from public.apf_traceability_links l join public.apf_evidence_sources e on e.id=l.evidence_source_id where l.acceptance_criterion_id=a.id and e.verification_status='verified')
 union all select'implementation:'||e.id,'implementation_without_requirement','warning','Implementação sem requisito rastreado',coalesce(c.stable_id,e.id::text)||' possui implementação verificável sem critério relacionado.','evidence_source',e.id from public.apf_evidence_sources e left join public.apf_evidence_catalog_entries c on c.evidence_source_id=e.id and c.dossier_id=e.dossier_id where e.dossier_id=p_dossier_id and e.verification_status='verified'and e.category in('api','code','interface','database','integration')and not exists(select 1 from public.apf_traceability_links l where l.evidence_source_id=e.id)
 )insert into public.apf_audit_findings(dossier_id,fingerprint,finding_type,severity,title,detail,entity_type,entity_id)select p_dossier_id,* from f on conflict(dossier_id,fingerprint)do update set severity=excluded.severity,title=excluded.title,detail=excluded.detail,status='open',resolution_note=null,reviewed_by=null,reviewed_at=null,detected_at=now();
 get diagnostics n=row_count;return n;
end $$;
revoke all on function public.assess_apf_evidence_quality(uuid)from public;grant execute on function public.assess_apf_evidence_quality(uuid)to authenticated;
