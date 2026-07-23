/**
 * OKR v2 — Ciclos (PR 3). Tipos alinhados a docs/okr-plano-mestre.md §§ 5.1 e 4.1.
 */

export type OkrCycleStatus =
  | "planning"
  | "active"
  | "closing"
  | "closed"
  | "archived"
  | "cancelled";

export type OkrCycleType =
  | "quarterly"
  | "annual"
  | "custom"
  | "monthly"
  | "biannual";

export type OkrCycleCadence = "daily" | "weekly" | "biweekly" | "monthly";

export type OkrCycleScoring =
  | "weighted_or_average"
  | "simple_average"
  | "weighted_average";

export interface OkrCycle {
  id: string;
  code: string;
  name: string;
  cycle_type: OkrCycleType;
  status: OkrCycleStatus;
  starts_at: string; // YYYY-MM-DD
  ends_at: string;
  timezone: string;
  check_in_frequency: OkrCycleCadence;
  scoring_method: OkrCycleScoring;
  published_at: string | null;
  closed_at: string | null;
  archived_at: string | null;
  objectives_count: number;
  created_at: string;
  updated_at: string;
}

export interface OkrCycleInput {
  code: string;
  name: string;
  cycle_type?: OkrCycleType;
  starts_at: string;
  ends_at: string;
  timezone?: string;
  check_in_frequency?: OkrCycleCadence;
  scoring_method?: OkrCycleScoring;
  recommended_objectives_min?: number | null;
  recommended_objectives_max?: number | null;
  recommended_krs_min?: number | null;
  recommended_krs_max?: number | null;
  allow_overachievement?: boolean;
}

export const OKR_CYCLE_STATUS_LABEL: Record<OkrCycleStatus, string> = {
  planning: "Em planejamento",
  active: "Ativo",
  closing: "Em fechamento",
  closed: "Fechado",
  archived: "Arquivado",
  cancelled: "Cancelado",
};

export const OKR_CYCLE_TYPE_LABEL: Record<OkrCycleType, string> = {
  quarterly: "Trimestral",
  annual: "Anual",
  custom: "Customizado",
  monthly: "Mensal",
  biannual: "Semestral",
};