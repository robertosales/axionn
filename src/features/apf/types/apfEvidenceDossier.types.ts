export type ApfDossierStatus = "draft" | "collecting_evidence" | "under_review" | "validated" | "homologated" | "superseded" | "cancelled";
export type ApfCountingType = "project" | "impact" | "corrective" | "recount";

export interface ApfEvidenceDossierSummary {
  id: string;
  organizationId: string;
  contractId: string;
  projectId: string;
  dossierCode: string;
  title: string;
  countingType: ApfCountingType;
  status: ApfDossierStatus;
  totalImpactedPf: number;
  totalHomologatedPf: number | null;
  countingSessionId: string | null;
  userStoryId: string | null;
  updatedAt: string;
  userStory: { code: string; title: string } | null;
}

export interface ApfGitEvidenceCandidates {
  hasIntegration: boolean;
  mergeRequests: Array<{ id: string; iid: number; title: string; state: string; sourceBranch: string; targetBranch: string; repository: string | null; webUrl: string | null; contentHash: string | null }>;
  commits: Array<{ sha: string; shortSha: string; message: string; authorName: string | null; repository: string | null; webUrl: string | null; committedAt: string }>;
}

export interface ApfDossierCountingItem {
  id: string;
  description: string;
  huRef: string | null;
  functionType: string;
  impactFactor: string;
  complexity: string;
  decision: string;
  det: number | null;
  ftr: number | null;
  ret: number | null;
  basePf: number;
  contributionPercent: number;
  impactedPf: number;
  isValidated: boolean;
  hasHumanOverride: boolean;
  hasMetricReview: boolean;
  metricReviewJustification: string | null;
}

export interface ApfDossierCountingMemory {
  sessionId: string;
  sessionStatus: string;
  sessionTotalPf: number;
  calculatedTotalPf: number;
  closes: boolean;
  items: ApfDossierCountingItem[];
}

export type ApfAuditScenarioStatus = "open" | "accepted" | "rejected" | "mitigated";

export interface ApfAuditScenario {
  id: string;
  dossierId: string;
  title: string;
  description: string;
  alternativeClassification: string | null;
  rationale: string;
  pfDelta: number;
  financialEffect: number | null;
  status: ApfAuditScenarioStatus;
  createdAt: string;
}

export interface SaveApfAuditScenarioInput {
  id?: string;
  dossierId: string;
  title: string;
  description: string;
  alternativeClassification: string;
  rationale: string;
  pfDelta: number;
  financialEffect: number | null;
  status: ApfAuditScenarioStatus;
}

export interface ApfDossierVersion {
  id: string;
  dossierId: string;
  versionNumber: number;
  renderedMarkdown: string;
  contentHash: string;
  createdBy: string;
  createdAt: string;
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

export type ApfEvidenceCategory = "api" | "code" | "interface" | "database" | "integration" | "test" | "document";
export type ApfEvidenceVerification = "unverified" | "verified" | "failed" | "stale";

export interface ApfEvidenceSource {
  id: string;
  dossierId: string;
  stableId: string;
  sourceType: "merge_request" | "commit" | "file" | "endpoint" | "database" | "test" | "attachment" | "link";
  category: ApfEvidenceCategory;
  summary: string;
  permanentUrl: string | null;
  contentHash: string | null;
  verificationStatus: ApfEvidenceVerification;
  collectedAt: string;
  criterionIds: string[];
}

export interface CreateApfEvidenceSourceInput {
  dossierId: string;
  stableId: string;
  category: ApfEvidenceCategory;
  sourceType: ApfEvidenceSource["sourceType"];
  summary: string;
  permanentUrl: string;
  contentHash: string;
  verificationStatus: ApfEvidenceVerification;
}

export interface ApfTraceabilitySuggestion {
  id: string;
  criterionId: string;
  evidenceSourceId: string;
  method: "lexical" | "ai";
  confidence: number;
  rationale: string;
}

export interface ApfAuditFinding {
  id: string; findingType: string; severity: "critical" | "warning" | "info"; title: string; detail: string;
  entityType: string | null; status: "open" | "resolved" | "accepted_risk"; resolutionNote: string | null; detectedAt: string;
}

export interface ApfLogicalFileReview {
  id: string | null; countingItemId: string; description: string; recognizable: boolean; maintained: boolean;
  independentLifecycle: boolean; insideBoundary: boolean; usedByTransaction: boolean;
  decision: "ALI" | "AIE" | "not_logical_file" | "pending"; justification: string;
}
export type ApfExceptionDisposition="counted"|"absorbed"|"reuse_zero_pf"|"not_countable"|"non_functional"|"pending_evidence"|"hu_implementation_divergence"|"audit_risk";
export interface ApfExceptionReview{countingItemId:string;description:string;disposition:ApfExceptionDisposition;absorbedByItemId:string|null;justification:string;}
export interface ApfMeasurementBatch{id:string;code:string;competence:string;status:"draft"|"under_review"|"approved"|"glosa_requested"|"glosa_resolved"|"closed"|"cancelled";totalPf:number;disputedPf:number;dossierCount:number;}

export const APF_DOSSIER_STATUS_LABELS: Record<ApfDossierStatus, string> = {
  draft: "Rascunho",
  collecting_evidence: "Coletando evidências",
  under_review: "Em revisão",
  validated: "Validado",
  homologated: "Homologado",
  superseded: "Substituído",
  cancelled: "Cancelado",
};
