import { supabase } from "@/integrations/supabase/client";
import { renderApfDossierMarkdown, sha256Hex, type ApfDossierDocumentData } from "../utils/apfDossierMarkdown";
import type {
  ApfDossierCreationOptions,
  ApfAcceptanceCriterion,
  ApfEvidenceSource,
  ApfDossierCountingMemory,
  ApfAuditScenario,
  ApfDossierVersion,
  ApfEvidenceDossierSummary,
  CreateApfEvidenceDossierInput,
  CreateApfEvidenceSourceInput,
  SaveApfAcceptanceCriterionInput,
  SaveApfAuditScenarioInput,
  ApfGitEvidenceCandidates,
  ApfTraceabilitySuggestion,
  ApfAuditFinding,
  ApfLogicalFileReview,
  ApfExceptionReview,
  ApfMeasurementBatch,
  ApfAuditPackageData,
  ApfGovernanceMetrics,
} from "../types/apfEvidenceDossier.types";

type DossierRow = {
  id: string; organization_id: string; contract_id:string;project_id:string; dossier_code: string; title: string;
  counting_type: ApfEvidenceDossierSummary["countingType"];
  status: ApfEvidenceDossierSummary["status"];
  total_impacted_pf: number | string; total_homologated_pf: number | string | null;
  updated_at: string; user_story_id: string | null; user_stories: { code: string; title: string } | null;
  counting_session_id: string | null;
};

export async function listApfEvidenceDossiers(organizationId: string): Promise<ApfEvidenceDossierSummary[]> {
  // Remove this narrow compatibility cast after regenerating Supabase types.
  const { data, error } = await supabase
    .from("apf_evidence_dossiers" as never)
    .select("id, organization_id, contract_id, project_id, dossier_code, title, counting_type, status, total_impacted_pf, total_homologated_pf, counting_session_id, user_story_id, updated_at, user_stories(code, title)")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DossierRow[]).map((row) => ({
    id: row.id, organizationId: row.organization_id, contractId:row.contract_id,projectId:row.project_id,dossierCode: row.dossier_code,
    title: row.title, countingType: row.counting_type, status: row.status,
    totalImpactedPf: Number(row.total_impacted_pf),
    totalHomologatedPf: row.total_homologated_pf === null ? null : Number(row.total_homologated_pf),
    updatedAt: row.updated_at, userStory: row.user_stories, userStoryId: row.user_story_id, countingSessionId: row.counting_session_id,
  }));
}

export async function listApfGitEvidenceCandidates(userStoryId: string, organizationId: string): Promise<ApfGitEvidenceCandidates> {
  const [{ count, error: integrationError }, { data: mergeRequests, error: mrError }, { data: commits, error: commitError }] = await Promise.all([
    supabase.from("git_integrations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", true),
    supabase.rpc("get_hu_merge_requests", { p_hu_id: userStoryId }),
    supabase.rpc("get_hu_commits", { p_hu_id: userStoryId, p_limit: 50 }),
  ]);
  if (integrationError) throw integrationError;
  if (mrError) throw mrError;
  if (commitError) throw commitError;
  type MrRow = { id: string; mr_iid: number; title: string; state: string; source_branch: string; target_branch: string; web_url: string | null; merge_commit_sha: string | null; integration_id: string };
  type CommitRow = { commit_sha: string; short_sha: string | null; message: string; author_name: string | null; web_url: string | null; committed_at: string; integration_id: string };
  const integrationIds = [...new Set([...(mergeRequests ?? []).map((row) => (row as MrRow).integration_id), ...(commits ?? []).map((row) => (row as CommitRow).integration_id)])];
  const { data: integrations, error: repositoriesError } = integrationIds.length
    ? await supabase.from("git_integrations").select("id, repository_path").in("id", integrationIds)
    : { data: [], error: null };
  if (repositoriesError) throw repositoriesError;
  const repositories = new Map((integrations ?? []).map((row) => [row.id, row.repository_path]));
  return {
    hasIntegration: (count ?? 0) > 0,
    mergeRequests: (mergeRequests ?? []).map((row) => { const mr = row as MrRow; return { id: mr.id, iid: mr.mr_iid, title: mr.title, state: mr.state, sourceBranch: mr.source_branch, targetBranch: mr.target_branch, repository: repositories.get(mr.integration_id) ?? null, webUrl: mr.web_url, contentHash: mr.merge_commit_sha }; }),
    commits: (commits ?? []).map((row) => { const commit = row as CommitRow; return { sha: commit.commit_sha, shortSha: commit.short_sha ?? commit.commit_sha.slice(0, 8), message: commit.message, authorName: commit.author_name, repository: repositories.get(commit.integration_id) ?? null, webUrl: commit.web_url, committedAt: commit.committed_at }; }),
  };
}

export async function importApfGitEvidence(dossierId: string, mergeRequestIds: string[], commitShas: string[]): Promise<number> {
  const { data, error } = await supabase.rpc("import_apf_git_provider_evidence" as never, { p_dossier_id: dossierId, p_merge_request_ids: mergeRequestIds, p_commit_shas: commitShas } as never);
  if (error) throw error;
  const { data: indexed, error: indexError } = await supabase.rpc("index_apf_git_artifacts" as never, { p_dossier_id: dossierId, p_commit_shas: commitShas } as never);
  if (indexError) throw indexError;
  return Number(data ?? 0) + Number(indexed ?? 0);
}

export async function importApfRedmineEvidence(dossierId:string):Promise<number>{const{data,error}=await supabase.rpc("import_apf_redmine_evidence"as never,{p_dossier_id:dossierId}as never);if(error)throw error;return Number(data??0);}

export async function listApfDossierVersions(dossierId: string): Promise<ApfDossierVersion[]> {
  const { data, error } = await supabase.from("apf_dossier_versions" as never).select("id, dossier_id, version_number, rendered_markdown, content_hash, created_by, created_at").eq("dossier_id", dossierId).order("version_number", { ascending: false });
  if (error) throw error;
  type Row = { id: string; dossier_id: string; version_number: number; rendered_markdown: string; content_hash: string; created_by: string; created_at: string };
  return ((data ?? []) as Row[]).map((row) => ({ id: row.id, dossierId: row.dossier_id, versionNumber: row.version_number, renderedMarkdown: row.rendered_markdown, contentHash: row.content_hash, createdBy: row.created_by, createdAt: row.created_at }));
}

export async function homologateApfDossier(dossierId: string, versionNumber: number): Promise<void> {
  const { error } = await supabase.rpc("homologate_apf_dossier" as never, { p_dossier_id: dossierId, p_version_number: versionNumber } as never);
  if (error) throw error;
}

export async function createApfDossierSuccessor(sourceDossierId: string, dossierCode: string, title: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_apf_dossier_successor" as never, { p_source_dossier_id: sourceDossierId, p_dossier_code: dossierCode.trim(), p_title: title.trim() } as never);
  if (error) throw error;
  return String(data);
}

export async function validateAndSnapshotApfDossier(data: ApfDossierDocumentData): Promise<{ markdown: string; hash: string; version: number }> {
  const markdown = renderApfDossierMarkdown(data);
  const hash = await sha256Hex(markdown);
  const snapshot = { generated_at: new Date().toISOString(), dossier: data.dossier, criteria: data.criteria, evidence: data.evidence, counting: data.counting, scenarios: data.scenarios };
  const { data: rpcData, error } = await supabase.rpc("validate_apf_dossier_snapshot" as never, { p_dossier_id: data.dossier.id, p_snapshot: snapshot, p_rendered_markdown: markdown, p_content_hash: hash, p_total_impacted_pf: data.counting.calculatedTotalPf } as never);
  if (error) throw error;
  const row = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as { version_number: number } | null;
  if (!row) throw new Error("O banco não retornou a versão validada.");
  const version = Number(row.version_number);
  return { markdown, hash, version };
}

export async function listApfAuditScenarios(dossierId: string): Promise<ApfAuditScenario[]> {
  const { data, error } = await supabase.from("apf_audit_scenarios" as never).select("id, dossier_id, title, description, alternative_classification, rationale, pf_delta, financial_effect, status, created_at").eq("dossier_id", dossierId).order("created_at", { ascending: false });
  if (error) throw error;
  type Row = { id: string; dossier_id: string; title: string; description: string; alternative_classification: string | null; rationale: string; pf_delta: number | string; financial_effect: number | string | null; status: ApfAuditScenario["status"]; created_at: string };
  return ((data ?? []) as Row[]).map((row) => ({ id: row.id, dossierId: row.dossier_id, title: row.title, description: row.description, alternativeClassification: row.alternative_classification, rationale: row.rationale, pfDelta: Number(row.pf_delta), financialEffect: row.financial_effect === null ? null : Number(row.financial_effect), status: row.status, createdAt: row.created_at }));
}

export async function saveApfAuditScenario(input: SaveApfAuditScenarioInput): Promise<void> {
  const payload = { dossier_id: input.dossierId, title: input.title.trim(), description: input.description.trim(), alternative_classification: input.alternativeClassification.trim() || null, rationale: input.rationale.trim(), pf_delta: input.pfDelta, financial_effect: input.financialEffect, status: input.status };
  const query = input.id ? supabase.from("apf_audit_scenarios" as never).update(payload as never).eq("id", input.id) : supabase.from("apf_audit_scenarios" as never).insert(payload as never);
  const { error } = await query;
  if (error) throw error;
}

export async function getApfDossierCountingMemory(sessionId: string): Promise<ApfDossierCountingMemory> {
  const [{ data: session, error: sessionError }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from("apf_counting_sessions" as never).select("id, status, total_pf_fs").eq("id", sessionId).single(),
    supabase.from("apf_counting_items" as never).select("id, hu_ref, ef_description, function_sigla, factor_sigla, complexity, counting_decision, source_payload, pf_bruto, contribution_pct, pf_fs, corrected_pf_bruto, corrected_pf_fs, is_validated").eq("session_id", sessionId).order("sort_order"),
  ]);
  if (sessionError) throw sessionError;
  if (itemsError) throw itemsError;
  type SessionRow = { id: string; status: string; total_pf_fs: number | string };
  type ItemRow = { id: string; hu_ref: string | null; ef_description: string; function_sigla: string; factor_sigla: string; complexity: string; counting_decision: string; source_payload: Record<string, unknown> | null; pf_bruto: number | string; contribution_pct: number | string; pf_fs: number | string; corrected_pf_bruto: number | string | null; corrected_pf_fs: number | string | null; is_validated: boolean };
  const sessionRow = session as SessionRow;
  const itemIds = ((items ?? []) as ItemRow[]).map((item) => item.id);
  const { data: metricReviews, error: metricError } = itemIds.length ? await supabase.from("apf_counting_metric_reviews" as never).select("counting_item_id, confirmed_det, confirmed_ftr, confirmed_ret, justification").in("counting_item_id", itemIds) : { data: [], error: null };
  if (metricError) throw metricError;
  type ReviewRow = { counting_item_id: string; confirmed_det: number | null; confirmed_ftr: number | null; confirmed_ret: number | null; justification: string };
  const reviewMap = new Map(((metricReviews ?? []) as ReviewRow[]).map((review) => [review.counting_item_id, review]));
  const mappedItems = ((items ?? []) as ItemRow[]).map((item) => {
    const payload = item.source_payload ?? {};
    const metric = (key: string) => { const value = payload[key]; return typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : null; };
    const review = reviewMap.get(item.id); return { id: item.id, description: item.ef_description, huRef: item.hu_ref, functionType: item.function_sigla, impactFactor: item.factor_sigla, complexity: item.complexity, decision: item.counting_decision, det: review?.confirmed_det ?? metric("det") ?? metric("det_count"), ftr: review?.confirmed_ftr ?? metric("ftr") ?? metric("ftr_count"), ret: review?.confirmed_ret ?? metric("ret") ?? metric("ret_count"), basePf: Number(item.corrected_pf_bruto ?? item.pf_bruto), contributionPercent: Number(item.contribution_pct), impactedPf: Number(item.corrected_pf_fs ?? item.pf_fs), isValidated: item.is_validated, hasHumanOverride: item.corrected_pf_fs !== null || item.corrected_pf_bruto !== null, hasMetricReview: Boolean(review), metricReviewJustification: review?.justification ?? null };
  });
  const calculatedTotalPf = Number(mappedItems.reduce((sum, item) => sum + item.impactedPf, 0).toFixed(2));
  const sessionTotalPf = Number(sessionRow.total_pf_fs);
  return { sessionId: sessionRow.id, sessionStatus: sessionRow.status, sessionTotalPf, calculatedTotalPf, closes: Math.abs(sessionTotalPf - calculatedTotalPf) <= 0.01, items: mappedItems };
}

export async function reviewApfCountingMetrics(dossierId: string, itemId: string, det: number | null, ftr: number | null, ret: number | null, justification: string): Promise<void> { const { error } = await supabase.rpc("review_apf_counting_metrics" as never, { p_dossier_id: dossierId, p_counting_item_id: itemId, p_det: det, p_ftr: ftr, p_ret: ret, p_justification: justification.trim() } as never); if (error) throw error; }

export async function listApfLogicalFileReviews(dossierId: string, sessionId: string): Promise<ApfLogicalFileReview[]> {
  const [{ data: items, error: itemError }, { data: reviews, error: reviewError }] = await Promise.all([
    supabase.from("apf_counting_items" as never).select("id, ef_description, function_sigla").eq("session_id", sessionId).in("function_sigla", ["ARQ","ALI","AIE","ILF","EIF"]),
    supabase.from("apf_logical_file_reviews" as never).select("id, counting_item_id, recognizable, maintained_by_application, independent_lifecycle, inside_boundary, used_by_transaction, decision, justification").eq("dossier_id", dossierId),
  ]); if (itemError) throw itemError; if (reviewError) throw reviewError;
  type Item = { id:string; ef_description:string }; type Review = { id:string; counting_item_id:string; recognizable:boolean; maintained_by_application:boolean; independent_lifecycle:boolean; inside_boundary:boolean; used_by_transaction:boolean; decision:ApfLogicalFileReview["decision"]; justification:string };
  const map=new Map(((reviews??[]) as Review[]).map((r)=>[r.counting_item_id,r]));
  return ((items??[]) as Item[]).map((item)=>{const r=map.get(item.id);return {id:r?.id??null,countingItemId:item.id,description:item.ef_description,recognizable:r?.recognizable??false,maintained:r?.maintained_by_application??false,independentLifecycle:r?.independent_lifecycle??false,insideBoundary:r?.inside_boundary??false,usedByTransaction:r?.used_by_transaction??false,decision:r?.decision??"pending",justification:r?.justification??""};});
}
export async function reviewApfLogicalFile(dossierId:string, review:ApfLogicalFileReview):Promise<void>{const {error}=await supabase.rpc("review_apf_logical_file" as never,{p_dossier_id:dossierId,p_counting_item_id:review.countingItemId,p_recognizable:review.recognizable,p_maintained:review.maintained,p_independent_lifecycle:review.independentLifecycle,p_inside_boundary:review.insideBoundary,p_used_by_transaction:review.usedByTransaction,p_decision:review.decision,p_justification:review.justification.trim()} as never);if(error)throw error;}
export async function listApfExceptionReviews(dossierId:string,sessionId:string):Promise<ApfExceptionReview[]>{const[{data:items,error:iError},{data:reviews,error:rError}]=await Promise.all([supabase.from("apf_counting_items" as never).select("id,ef_description,counting_decision,absorbed_by_item_id,justification").eq("session_id",sessionId).order("sort_order"),supabase.from("apf_exception_reviews" as never).select("counting_item_id,disposition,absorbed_by_item_id,justification").eq("dossier_id",dossierId)]);if(iError)throw iError;if(rError)throw rError;type I={id:string;ef_description:string;counting_decision:string;absorbed_by_item_id:string|null;justification:string|null};type R={counting_item_id:string;disposition:ApfExceptionReview["disposition"];absorbed_by_item_id:string|null;justification:string};const map=new Map(((reviews??[])as R[]).map(r=>[r.counting_item_id,r]));return((items??[])as I[]).map(i=>{const r=map.get(i.id);return{countingItemId:i.id,description:i.ef_description,disposition:r?.disposition??(i.counting_decision==="absorbed"?"absorbed":i.counting_decision==="not_countable"?"not_countable":"counted"),absorbedByItemId:r?.absorbed_by_item_id??i.absorbed_by_item_id,justification:r?.justification??i.justification??""};});}
export async function reviewApfException(dossierId:string,review:ApfExceptionReview):Promise<void>{const{error}=await supabase.rpc("review_apf_exception" as never,{p_dossier_id:dossierId,p_counting_item_id:review.countingItemId,p_disposition:review.disposition,p_absorbed_by:review.absorbedByItemId,p_justification:review.justification.trim()}as never);if(error)throw error;}
export async function listApfMeasurementBatches(organizationId:string):Promise<ApfMeasurementBatch[]>{const{data,error}=await supabase.from("apf_measurement_batches"as never).select("id,code,competence,status,total_pf,disputed_pf,apf_measurement_batch_dossiers(count),apf_measurement_billing_requests(status)").eq("organization_id",organizationId).order("competence",{ascending:false});if(error)throw error;type R={id:string;code:string;competence:string;status:ApfMeasurementBatch["status"];total_pf:number|string;disputed_pf:number|string;apf_measurement_batch_dossiers:Array<{count:number}>;apf_measurement_billing_requests:Array<{status:ApfMeasurementBatch["billingStatus"]}>};return((data??[])as R[]).map(r=>({id:r.id,code:r.code,competence:r.competence,status:r.status,totalPf:Number(r.total_pf),disputedPf:Number(r.disputed_pf),dossierCount:r.apf_measurement_batch_dossiers?.[0]?.count??0,billingStatus:r.apf_measurement_billing_requests?.[0]?.status??null}));}
export async function createApfMeasurementBatch(organizationId:string,contractId:string,projectId:string,competence:string,code:string,dossierIds:string[]):Promise<string>{const{data,error}=await supabase.rpc("create_apf_measurement_batch"as never,{p_organization_id:organizationId,p_contract_id:contractId,p_project_id:projectId,p_competence:competence,p_code:code.trim(),p_dossier_ids:dossierIds}as never);if(error)throw error;return String(data);}
export async function transitionApfMeasurementBatch(batchId:string,decision:string,note:string,disputedPf:number|null=null):Promise<void>{const{error}=await supabase.rpc("transition_apf_measurement_batch"as never,{p_batch_id:batchId,p_decision:decision,p_note:note.trim(),p_disputed_pf:disputedPf}as never);if(error)throw error;}
export async function submitApfBatchForBilling(batchId:string,unitPrice:number,dueDate:string,note:string):Promise<string>{const{data,error}=await supabase.rpc("submit_apf_batch_for_billing"as never,{p_batch_id:batchId,p_unit_price:unitPrice,p_due_date:dueDate,p_note:note.trim()}as never);if(error)throw error;return String(data);}
export async function getApfGovernanceMetrics(organizationId:string):Promise<ApfGovernanceMetrics>{const{data,error}=await supabase.rpc("get_apf_governance_metrics"as never,{p_organization_id:organizationId}as never);if(error)throw error;const r=data as Record<string,number>;return{dossierCount:Number(r.dossier_count??0),homologatedCount:Number(r.homologated_count??0),suggestionReviewCount:Number(r.suggestion_review_count??0),suggestionAcceptanceRate:Number(r.suggestion_acceptance_rate??0),openAuditFindings:Number(r.open_audit_findings??0),criticalOpenFindings:Number(r.critical_open_findings??0),approvedPf:Number(r.approved_pf??0),disputedPf:Number(r.disputed_pf??0),glosaRate:Number(r.glosa_rate??0),countingDivergencePf:Number(r.counting_divergence_pf??0)};}
export async function getApfAuditPackageData(batchId:string):Promise<ApfAuditPackageData>{
 const[{data:batch,error:bError},{data:members,error:mError},{data:decisions,error:dError}]=await Promise.all([supabase.from("apf_measurement_batches"as never).select("id,code,competence,status,total_pf,disputed_pf,updated_at").eq("id",batchId).single(),supabase.from("apf_measurement_batch_dossiers"as never).select("dossier_id,pf_snapshot,content_hash").eq("batch_id",batchId),supabase.from("apf_measurement_batch_decisions"as never).select("decision,note,disputed_pf,actor_id,created_at").eq("batch_id",batchId).order("created_at")]);if(bError)throw bError;if(mError)throw mError;if(dError)throw dError;
 type B={id:string;code:string;competence:string;status:ApfMeasurementBatch["status"];total_pf:number|string;disputed_pf:number|string;updated_at:string};type M={dossier_id:string;pf_snapshot:number|string;content_hash:string};type D={decision:string;note:string;disputed_pf:number|string|null;actor_id:string;created_at:string};const memberRows=(members??[])as M[];const ids=memberRows.map(m=>m.dossier_id);
 const[{data:dossiers,error:dsError},{data:versions,error:vError}]=ids.length?await Promise.all([supabase.from("apf_evidence_dossiers"as never).select("id,dossier_code,title").in("id",ids),supabase.from("apf_dossier_versions"as never).select("dossier_id,version_number,rendered_markdown,content_hash").in("dossier_id",ids).order("version_number",{ascending:false})]):[{data:[],error:null},{data:[],error:null}];if(dsError)throw dsError;if(vError)throw vError;type DS={id:string;dossier_code:string;title:string};type V={dossier_id:string;version_number:number;rendered_markdown:string;content_hash:string};const dsMap=new Map(((dossiers??[])as DS[]).map(d=>[d.id,d]));const vMap=new Map<string,V>();for(const v of(versions??[])as V[])if(!vMap.has(v.dossier_id))vMap.set(v.dossier_id,v);const b=batch as B;
 return{batch:{id:b.id,code:b.code,competence:b.competence,status:b.status,totalPf:Number(b.total_pf),disputedPf:Number(b.disputed_pf),dossierCount:memberRows.length,updatedAt:b.updated_at},dossiers:memberRows.map(m=>{const ds=dsMap.get(m.dossier_id)!;const v=vMap.get(m.dossier_id)!;return{code:ds.dossier_code,title:ds.title,pf:Number(m.pf_snapshot),hash:m.content_hash,version:v.version_number,markdown:v.rendered_markdown};}).sort((a,b)=>a.code.localeCompare(b.code)),decisions:((decisions??[])as D[]).map(d=>({decision:d.decision,note:d.note,disputedPf:d.disputed_pf===null?null:Number(d.disputed_pf),actorId:d.actor_id,createdAt:d.created_at}))};
}

export async function listApfEvidenceSources(dossierId: string): Promise<ApfEvidenceSource[]> {
  const [{ data: sources, error: sourceError }, { data: catalog, error: catalogError }, { data: links, error: linkError }] = await Promise.all([
    supabase.from("apf_evidence_sources" as never).select("id, dossier_id, source_type, category, summary, permanent_url, content_hash, verification_status, collected_at").eq("dossier_id", dossierId).order("collected_at", { ascending: false }),
    supabase.from("apf_evidence_catalog_entries" as never).select("evidence_source_id, stable_id").eq("dossier_id", dossierId),
    supabase.from("apf_traceability_links" as never).select("evidence_source_id, acceptance_criterion_id").eq("dossier_id", dossierId),
  ]);
  if (sourceError) throw sourceError;
  if (catalogError) throw catalogError;
  if (linkError) throw linkError;
  type SourceRow = Omit<ApfEvidenceSource, "dossierId" | "stableId" | "criterionIds" | "sourceType" | "permanentUrl" | "contentHash" | "verificationStatus" | "collectedAt"> & { dossier_id: string; source_type: ApfEvidenceSource["sourceType"]; permanent_url: string | null; content_hash: string | null; verification_status: ApfEvidenceSource["verificationStatus"]; collected_at: string };
  const stableIds = new Map(((catalog ?? []) as Array<{ evidence_source_id: string; stable_id: string }>).map((row) => [row.evidence_source_id, row.stable_id]));
  const criterionIds = new Map<string, string[]>();
  for (const link of (links ?? []) as Array<{ evidence_source_id: string; acceptance_criterion_id: string }>) criterionIds.set(link.evidence_source_id, [...(criterionIds.get(link.evidence_source_id) ?? []), link.acceptance_criterion_id]);
  return ((sources ?? []) as SourceRow[]).map((row) => ({ id: row.id, dossierId: row.dossier_id, stableId: stableIds.get(row.id) ?? "EV-PENDENTE", sourceType: row.source_type, category: row.category, summary: row.summary, permanentUrl: row.permanent_url, contentHash: row.content_hash, verificationStatus: row.verification_status, collectedAt: row.collected_at, criterionIds: criterionIds.get(row.id) ?? [] }));
}

export async function createApfEvidenceSource(input: CreateApfEvidenceSourceInput): Promise<void> {
  const { data: source, error: sourceError } = await supabase.from("apf_evidence_sources" as never).insert({ dossier_id: input.dossierId, source_type: input.sourceType, category: input.category, summary: input.summary.trim(), permanent_url: input.permanentUrl.trim() || null, content_hash: input.contentHash.trim() || null, verification_status: input.verificationStatus } as never).select("id").single();
  if (sourceError) throw sourceError;
  const sourceId = (source as { id: string }).id;
  const { error: catalogError } = await supabase.from("apf_evidence_catalog_entries" as never).insert({ dossier_id: input.dossierId, evidence_source_id: sourceId, stable_id: input.stableId.trim(), display_title: input.summary.trim(), display_summary: input.summary.trim() } as never);
  if (catalogError) throw catalogError;
}

export async function linkApfCriterionToEvidence(dossierId: string, criterionId: string, evidenceSourceId: string): Promise<void> {
  const { data: existing, error: lookupError } = await supabase.from("apf_traceability_links" as never).select("id").eq("dossier_id", dossierId).eq("acceptance_criterion_id", criterionId).eq("evidence_source_id", evidenceSourceId).is("counting_item_id", null).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return;
  const { error } = await supabase.from("apf_traceability_links" as never).insert({ dossier_id: dossierId, acceptance_criterion_id: criterionId, evidence_source_id: evidenceSourceId, functional_result: "pending" } as never);
  if (error) throw error;
}

export async function listApfTraceabilitySuggestions(dossierId: string): Promise<ApfTraceabilitySuggestion[]> {
  const { data, error } = await supabase.from("apf_traceability_suggestions" as never).select("id, acceptance_criterion_id, evidence_source_id, method, confidence, rationale").eq("dossier_id", dossierId).eq("status", "pending").order("confidence", { ascending: false });
  if (error) throw error;
  type Row = { id: string; acceptance_criterion_id: string; evidence_source_id: string; method: "lexical" | "ai"; confidence: number | string; rationale: string };
  return ((data ?? []) as Row[]).map((row) => ({ id: row.id, criterionId: row.acceptance_criterion_id, evidenceSourceId: row.evidence_source_id, method: row.method, confidence: Number(row.confidence), rationale: row.rationale }));
}

export async function generateApfTraceabilitySuggestions(dossierId: string): Promise<number> {
  const { data, error } = await supabase.rpc("generate_apf_traceability_suggestions" as never, { p_dossier_id: dossierId } as never);
  if (error) throw error;
  return Number(data ?? 0);
}

export async function reviewApfTraceabilitySuggestion(suggestionId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc("review_apf_traceability_suggestion" as never, { p_suggestion_id: suggestionId, p_accept: accept } as never);
  if (error) throw error;
}

export async function listApfAuditFindings(dossierId: string): Promise<ApfAuditFinding[]> {
  const { data, error } = await supabase.from("apf_audit_findings" as never).select("id, finding_type, severity, title, detail, entity_type, status, resolution_note, detected_at").eq("dossier_id", dossierId).order("detected_at", { ascending: false });
  if (error) throw error;
  type Row = { id: string; finding_type: string; severity: ApfAuditFinding["severity"]; title: string; detail: string; entity_type: string | null; status: ApfAuditFinding["status"]; resolution_note: string | null; detected_at: string };
  return ((data ?? []) as Row[]).map((row) => ({ id: row.id, findingType: row.finding_type, severity: row.severity, title: row.title, detail: row.detail, entityType: row.entity_type, status: row.status, resolutionNote: row.resolution_note, detectedAt: row.detected_at }));
}
export async function scanApfDossierAudit(dossierId: string): Promise<number> { const { data, error } = await supabase.rpc("scan_apf_dossier_audit" as never, { p_dossier_id: dossierId } as never); if (error) throw error; const {data:quality,error:qualityError}=await supabase.rpc("assess_apf_evidence_quality" as never,{p_dossier_id:dossierId}as never);if(qualityError)throw qualityError;return Number(data??0)+Number(quality??0); }
export async function reviewApfAuditFinding(findingId: string, status: "resolved" | "accepted_risk", note: string): Promise<void> { const { error } = await supabase.rpc("review_apf_audit_finding" as never, { p_finding_id: findingId, p_status: status, p_note: note.trim() } as never); if (error) throw error; }

export async function listApfAcceptanceCriteria(dossierId: string): Promise<ApfAcceptanceCriterion[]> {
  const { data, error } = await supabase.from("apf_acceptance_criteria" as never)
    .select("id, dossier_id, stable_id, sort_order, original_text, expected_behavior, decision, source_type, reviewed_at")
    .eq("dossier_id", dossierId).order("sort_order");
  if (error) throw error;
  type Row = { id: string; dossier_id: string; stable_id: string; sort_order: number; original_text: string; expected_behavior: string | null; decision: ApfAcceptanceCriterion["decision"]; source_type: ApfAcceptanceCriterion["sourceType"]; reviewed_at: string | null };
  return ((data ?? []) as Row[]).map((row) => ({ id: row.id, dossierId: row.dossier_id, stableId: row.stable_id, sortOrder: row.sort_order, originalText: row.original_text, expectedBehavior: row.expected_behavior, decision: row.decision, sourceType: row.source_type, reviewedAt: row.reviewed_at }));
}

export async function saveApfAcceptanceCriterion(input: SaveApfAcceptanceCriterionInput): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw authError ?? new Error("Sessão inválida.");
  const payload = {
    dossier_id: input.dossierId, stable_id: input.stableId.trim(), sort_order: input.sortOrder,
    original_text: input.originalText.trim(), expected_behavior: input.expectedBehavior.trim() || null,
    decision: input.decision, source_type: "manual",
    reviewed_by: input.decision ? authData.user.id : null,
    reviewed_at: input.decision ? new Date().toISOString() : null,
  };
  const query = input.id
    ? supabase.from("apf_acceptance_criteria" as never).update(payload as never).eq("id", input.id)
    : supabase.from("apf_acceptance_criteria" as never).insert(payload as never);
  const { error } = await query;
  if (error) throw error;
}

export async function getApfDossierCreationOptions(organizationId: string): Promise<ApfDossierCreationOptions> {
  const [{ data: projects, error: projectsError }, { data: teams, error: teamsError }, { data: sessions, error: sessionsError }] = await Promise.all([
    supabase.from("projects" as never).select("id, name, code, contract_id, contracts!inner(id, name, org_id)").eq("contracts.org_id", organizationId).eq("status", "active").order("name"),
    supabase.from("teams" as never).select("id, project_id, user_stories(id, code, title, sprint_id)").not("project_id", "is", null),
    supabase.from("apf_counting_sessions" as never).select("id, project_id, baseline_id, model_id, sprint_ref, status").order("updated_at", { ascending: false }),
  ]);
  if (projectsError) throw projectsError;
  if (teamsError) throw teamsError;
  if (sessionsError) throw sessionsError;

  type ProjectRow = { id: string; name: string; code: string | null; contract_id: string; contracts: { name: string } };
  type TeamRow = { project_id: string; user_stories: Array<{ id: string; code: string; title: string; sprint_id: string | null }> };
  type SessionRow = { id: string; project_id: string; baseline_id: string | null; model_id: string; sprint_ref: string | null; status: string };
  const allowedProjects = new Set(((projects ?? []) as ProjectRow[]).map((project) => project.id));

  return {
    projects: ((projects ?? []) as ProjectRow[]).map((project) => ({ id: project.id, name: project.name, code: project.code, contractId: project.contract_id, contractName: project.contracts.name })),
    userStories: ((teams ?? []) as TeamRow[]).flatMap((team) => allowedProjects.has(team.project_id) ? (team.user_stories ?? []).map((story) => ({ ...story, projectId: team.project_id, sprintId: story.sprint_id })) : []),
    sessions: ((sessions ?? []) as SessionRow[]).filter((session) => allowedProjects.has(session.project_id)).map((session) => ({ id: session.id, projectId: session.project_id, baselineId: session.baseline_id, modelId: session.model_id, sprintRef: session.sprint_ref, status: session.status })),
  };
}

export async function createApfEvidenceDossier(input: CreateApfEvidenceDossierInput): Promise<string> {
  const { data, error } = await supabase.from("apf_evidence_dossiers" as never).insert({
    organization_id: input.organizationId,
    contract_id: input.project.contractId,
    project_id: input.project.id,
    sprint_id: input.userStory.sprintId,
    user_story_id: input.userStory.id,
    counting_session_id: input.session?.id ?? null,
    baseline_id: input.session?.baselineId ?? null,
    counting_model_id: input.session?.modelId ?? null,
    dossier_code: input.dossierCode.trim(),
    title: input.title.trim(),
    counting_type: input.countingType,
    contract_snapshot: { id: input.project.contractId, name: input.project.contractName },
    baseline_snapshot: { id: input.session?.baselineId ?? null },
    ruleset_snapshot: { counting_model_id: input.session?.modelId ?? null },
  } as never).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}
