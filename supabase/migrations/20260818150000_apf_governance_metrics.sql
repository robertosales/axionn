create or replace function public.get_apf_governance_metrics(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid()is null or not public.is_organization_member(p_organization_id,auth.uid())then raise exception'Acesso negado.'using errcode='42501';end if;
 with dossiers as(select id,status,total_impacted_pf,total_homologated_pf from public.apf_evidence_dossiers where organization_id=p_organization_id),
 suggestions as(select s.status from public.apf_traceability_suggestions s join dossiers d on d.id=s.dossier_id where s.status in('accepted','rejected')),
 findings as(select f.status,f.severity from public.apf_audit_findings f join dossiers d on d.id=f.dossier_id),
 batches as(select total_pf,disputed_pf,status from public.apf_measurement_batches where organization_id=p_organization_id)
 select jsonb_build_object(
  'dossier_count',(select count(*)from dossiers),'homologated_count',(select count(*)from dossiers where status='homologated'),
  'suggestion_review_count',(select count(*)from suggestions),'suggestion_acceptance_rate',coalesce((select round(100.0*count(*)filter(where status='accepted')/nullif(count(*),0),1)from suggestions),0),
  'open_audit_findings',(select count(*)from findings where status='open'),'critical_open_findings',(select count(*)from findings where status='open'and severity='critical'),
  'approved_pf',coalesce((select round(sum(greatest(total_pf-disputed_pf,0)),2)from batches where status in('approved','glosa_resolved','closed')),0),
  'disputed_pf',coalesce((select round(sum(disputed_pf),2)from batches where status in('glosa_requested','glosa_resolved','closed')),0),
  'glosa_rate',coalesce((select round(100.0*sum(disputed_pf)/nullif(sum(total_pf),0),1)from batches where status in('glosa_requested','glosa_resolved','closed')),0),
  'counting_divergence_pf',coalesce((select round(sum(abs(coalesce(total_homologated_pf,total_impacted_pf)-total_impacted_pf)),2)from dossiers),0)
 )into result;return result;
end $$;
revoke all on function public.get_apf_governance_metrics(uuid)from public,anon;grant execute on function public.get_apf_governance_metrics(uuid)to authenticated;
