export type OkrReviewStatus = "pending" | "in_review" | "submitted" | "approved" | "rejected";

export type OkrCarryForwardType =
  | "full_objective"
  | "selected_key_results"
  | "rewritten_objective"
  | "learning_only";

export type OkrCarryForwardDecision = "none" | OkrCarryForwardType;

export const OKR_REVIEW_STATUS_LABEL: Record<OkrReviewStatus, string> = {
  pending: "Pendente",
  in_review: "Em revisão",
  submitted: "Enviada",
  approved: "Aprovada",
  rejected: "Rejeitada",
};

export const OKR_CARRY_FORWARD_LABEL: Record<OkrCarryForwardDecision, string> = {
  none: "Não transferir",
  full_objective: "Objective completo",
  selected_key_results: "Key Results selecionados",
  rewritten_objective: "Objective reescrito",
  learning_only: "Somente aprendizado",
};

export interface OkrObjectiveReview {
  id: string;
  organization_id: string;
  cycle_id: string | null;
  objective_id: string;
  review_status: OkrReviewStatus;
  final_score: number | null;
  final_health: string | null;
  impact_rating: string | null;
  outcome_summary: string | null;
  what_worked: string | null;
  what_did_not_work: string | null;
  lessons_learned: string | null;
  recommendation: string | null;
  carry_forward_decision: OkrCarryForwardDecision | null;
  carry_forward_reason: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OkrObjectiveReviewInput {
  final_score?: number | null;
  final_health?: string | null;
  impact_rating?: string | null;
  outcome_summary: string;
  what_worked?: string | null;
  what_did_not_work?: string | null;
  lessons_learned?: string | null;
  recommendation?: string | null;
  carry_forward_decision?: OkrCarryForwardDecision | null;
  carry_forward_reason?: string | null;
}

export interface OkrCycleReview {
  id: string;
  organization_id: string;
  cycle_id: string;
  final_score: number | null;
  objectives_total: number;
  objectives_completed: number;
  objectives_cancelled: number;
  objectives_carried_forward: number;
  check_in_compliance: number | null;
  main_achievements: string | null;
  main_failures: string | null;
  cross_team_dependencies: string | null;
  lessons_learned: string | null;
  strategic_recommendations: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OkrCycleReviewInput {
  main_achievements?: string | null;
  main_failures?: string | null;
  cross_team_dependencies?: string | null;
  lessons_learned?: string | null;
  strategic_recommendations?: string | null;
}
