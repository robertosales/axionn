export type ApfDossierStatus = "draft" | "collecting_evidence" | "under_review" | "validated" | "homologated" | "superseded" | "cancelled";
export type ApfCountingType = "project" | "impact" | "corrective" | "recount";

export interface ApfEvidenceDossierSummary {
  id: string;
  organizationId: string;
  dossierCode: string;
  title: string;
  countingType: ApfCountingType;
  status: ApfDossierStatus;
  totalImpactedPf: number;
  totalHomologatedPf: number | null;
  updatedAt: string;
  userStory: { code: string; title: string } | null;
}

export interface ApfDossierCreationProject {
  id: string;
  name: string;
  code: string | null;
  contractId: string;
  contractName: string;
}

export interface ApfDossierCreationUserStory {
  id: string;
  code: string;
  title: string;
  sprintId: string | null;
  projectId: string;
}

export interface ApfDossierCreationSession {
  id: string;
  projectId: string;
  baselineId: string | null;
  modelId: string;
  sprintRef: string | null;
  status: string;
}

export interface ApfDossierCreationOptions {
  projects: ApfDossierCreationProject[];
  userStories: ApfDossierCreationUserStory[];
  sessions: ApfDossierCreationSession[];
}

export interface CreateApfEvidenceDossierInput {
  organizationId: string;
  dossierCode: string;
  title: string;
  countingType: ApfCountingType;
  project: ApfDossierCreationProject;
  userStory: ApfDossierCreationUserStory;
  session: ApfDossierCreationSession | null;
}

export type ApfAcceptanceDecision = "meets" | "partially_meets" | "does_not_meet" | "not_applicable";

export interface ApfAcceptanceCriterion {
  id: string;
  dossierId: string;
  stableId: string;
  sortOrder: number;
  originalText: string;
  expectedBehavior: string | null;
  decision: ApfAcceptanceDecision | null;
  sourceType: "user_story" | "gitlab_issue" | "file" | "manual";
  reviewedAt: string | null;
}

export interface SaveApfAcceptanceCriterionInput {
  id?: string;
  dossierId: string;
  stableId: string;
  sortOrder: number;
  originalText: string;
  expectedBehavior: string;
  decision: ApfAcceptanceDecision | null;
}

export const APF_DOSSIER_STATUS_LABELS: Record<ApfDossierStatus, string> = {
  draft: "Rascunho",
  collecting_evidence: "Coletando evidências",
  under_review: "Em revisão",
  validated: "Validado",
  homologated: "Homologado",
  superseded: "Substituído",
  cancelled: "Cancelado",
};
