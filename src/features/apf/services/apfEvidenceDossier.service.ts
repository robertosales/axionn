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
} from "../types/apfEvidenceDossier.types";

type DossierRow = {
  id: string; organization_id: string; dossier_code: string; title: string;
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
    .select("id, organization_id, dossier_code, title, counting_type, status, total_impacted_pf, total_homologated_pf, counting_session_id, user_story_id, updated_at, user_stories(code, title)")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DossierRow[]).map((row) => ({
    id: row.id, organizationId: row.organization_id, dossierCode: row.dossier_code,
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
  const { data, error } = await supabase.rpc("import_apf_git_evidence" as never, { p_dossier_id: dossierId, p_merge_request_ids: mergeRequestIds, p_commit_shas: commitShas } as never);
  if (error) throw error;
  return Number(data ?? 0);
}

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
  const mappedItems = ((items ?? []) as ItemRow[]).map((item) => {
    const payload = item.source_payload ?? {};
    const metric = (key: string) => { const value = payload[key]; return typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : null; };
    return { id: item.id, description: item.ef_description, huRef: item.hu_ref, functionType: item.function_sigla, impactFactor: item.factor_sigla, complexity: item.complexity, decision: item.counting_decision, det: metric("det") ?? metric("det_count"), ftr: metric("ftr") ?? metric("ftr_count"), ret: metric("ret") ?? metric("ret_count"), basePf: Number(item.corrected_pf_bruto ?? item.pf_bruto), contributionPercent: Number(item.contribution_pct), impactedPf: Number(item.corrected_pf_fs ?? item.pf_fs), isValidated: item.is_validated, hasHumanOverride: item.corrected_pf_fs !== null || item.corrected_pf_bruto !== null };
  });
  const calculatedTotalPf = Number(mappedItems.reduce((sum, item) => sum + item.impactedPf, 0).toFixed(2));
  const sessionTotalPf = Number(sessionRow.total_pf_fs);
  return { sessionId: sessionRow.id, sessionStatus: sessionRow.status, sessionTotalPf, calculatedTotalPf, closes: Math.abs(sessionTotalPf - calculatedTotalPf) <= 0.01, items: mappedItems };
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
