import { supabase } from "@/integrations/supabase/client";
import type {
  ApfDossierCreationOptions,
  ApfAcceptanceCriterion,
  ApfEvidenceDossierSummary,
  CreateApfEvidenceDossierInput,
  SaveApfAcceptanceCriterionInput,
} from "../types/apfEvidenceDossier.types";

type DossierRow = {
  id: string; organization_id: string; dossier_code: string; title: string;
  counting_type: ApfEvidenceDossierSummary["countingType"];
  status: ApfEvidenceDossierSummary["status"];
  total_impacted_pf: number | string; total_homologated_pf: number | string | null;
  updated_at: string; user_stories: { code: string; title: string } | null;
};

export async function listApfEvidenceDossiers(organizationId: string): Promise<ApfEvidenceDossierSummary[]> {
  // Remove this narrow compatibility cast after regenerating Supabase types.
  const { data, error } = await supabase
    .from("apf_evidence_dossiers" as never)
    .select("id, organization_id, dossier_code, title, counting_type, status, total_impacted_pf, total_homologated_pf, updated_at, user_stories(code, title)")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DossierRow[]).map((row) => ({
    id: row.id, organizationId: row.organization_id, dossierCode: row.dossier_code,
    title: row.title, countingType: row.counting_type, status: row.status,
    totalImpactedPf: Number(row.total_impacted_pf),
    totalHomologatedPf: row.total_homologated_pf === null ? null : Number(row.total_homologated_pf),
    updatedAt: row.updated_at, userStory: row.user_stories,
  }));
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
