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

export const APF_DOSSIER_STATUS_LABELS: Record<ApfDossierStatus, string> = {
  draft: "Rascunho",
  collecting_evidence: "Coletando evidências",
  under_review: "Em revisão",
  validated: "Validado",
  homologated: "Homologado",
  superseded: "Substituído",
  cancelled: "Cancelado",
};
