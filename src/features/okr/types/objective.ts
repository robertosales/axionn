/**
 * OKR v2 — Objectives + Alignments (PR 4). docs/okr-plano-mestre.md §§ 3.2, 3.6, 5.2, 5.3.
 */

export type OkrObjectiveLevel =
  | "organizational"
  | "portfolio"
  | "product"
  | "contract"
  | "project"
  | "team";

export type OkrObjectiveLifecycle =
  | "draft"
  | "ready"
  | "active"
  | "paused"
  | "cancelled"
  | "completed"
  | "archived";

export type OkrAlignmentType =
  | "contributes_to"
  | "supports"
  | "depends_on"
  | "conflicts_with";

export interface OkrObjectiveV2 {
  id: string;
  organization_id: string;
  cycle_id: string | null;
  cycle_code: string | null;
  title: string;
  description: string | null;
  team_id: string | null;
  team_name: string | null;
  owner_id: string | null;
  sponsor_id: string | null;
  objective_level: OkrObjectiveLevel;
  scope_type: string;
  parent_objective_id: string | null;
  lifecycle_status: OkrObjectiveLifecycle;
  status: string;
  progress: number;
  calculated_progress: number | null;
  calculated_health: string;
  start_date: string | null;
  end_date: string | null;
  published_at: string | null;
  archived_at: string | null;
  lock_version: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface OkrObjectiveV2Input {
  cycle_id: string;
  title: string;
  description?: string | null;
  team_id?: string | null;
  owner_id?: string | null;
  sponsor_id?: string | null;
  objective_level?: OkrObjectiveLevel;
  scope_type?: string;
  parent_objective_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface OkrObjectiveV2Update extends Partial<OkrObjectiveV2Input> {
  lock_version: number;
  manual_health_override?: string | null;
  health_override_reason?: string | null;
}

export interface OkrAlignmentV1 {
  id: string;
  source_objective_id: string;
  source_title: string;
  target_objective_id: string;
  target_title: string;
  alignment_type: OkrAlignmentType;
  contribution_weight: number | null;
  rationale: string | null;
  created_at: string;
  created_by: string;
}

export interface OkrAlignmentV1Input {
  source_objective_id: string;
  target_objective_id: string;
  alignment_type: OkrAlignmentType;
  contribution_weight?: number | null;
  rationale?: string | null;
}

export const OKR_OBJECTIVE_LIFECYCLE_LABEL: Record<OkrObjectiveLifecycle, string> = {
  draft: "Rascunho",
  ready: "Pronto",
  active: "Ativo",
  paused: "Pausado",
  cancelled: "Cancelado",
  completed: "Concluído",
  archived: "Arquivado",
};

export const OKR_OBJECTIVE_LEVEL_LABEL: Record<OkrObjectiveLevel, string> = {
  organizational: "Organizacional",
  portfolio: "Portfólio",
  product: "Produto",
  contract: "Contrato",
  project: "Projeto",
  team: "Time",
};

export const OKR_ALIGNMENT_TYPE_LABEL: Record<OkrAlignmentType, string> = {
  contributes_to: "Contribui para",
  supports: "Apoia",
  depends_on: "Depende de",
  conflicts_with: "Conflita com",
};