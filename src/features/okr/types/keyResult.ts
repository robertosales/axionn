/**
 * OKR v2 — Key Results (PR 5). Motor canônico no backend (`calculate_okr_kr_progress_v2`).
 */

export type OkrKrDirection = "increase" | "decrease" | "range" | "boolean";
export type OkrKrUpdateType = "manual" | "automatic" | "hybrid";
export type OkrKrFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "manual";
export type OkrKrLifecycle =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "cancelled"
  | "archived";

export type OkrKrUnit = "%" | "pts" | "bugs" | "score" | "dias" | "bool" | "R$" | "un";

export interface OkrKeyResultV2 {
  id: string;
  objective_id: string;
  title: string;
  description: string | null;
  unit: OkrKrUnit | string;
  direction: OkrKrDirection | string;
  baseline_value: number | null;
  current_value: number | null;
  target_value: number | null;
  target_min: number | null;
  target_max: number | null;
  weight: number | null;
  owner_id: string | null;
  update_type: OkrKrUpdateType | string;
  frequency: OkrKrFrequency | string;
  metric_code: string | null;
  start_date: string | null;
  end_date: string | null;
  allow_overachievement: boolean;
  raw_progress: number | null;
  calculated_progress: number | null;
  calculated_health: string;
  measurement_quality: string;
  lifecycle_status: OkrKrLifecycle | string;
  formula_version: string | null;
  lock_version: number;
  last_measured_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OkrKeyResultV2Input {
  title: string;
  description?: string | null;
  unit?: OkrKrUnit;
  direction?: OkrKrDirection;
  baseline_value?: number | null;
  current_value?: number | null;
  target_value?: number | null;
  target_min?: number | null;
  target_max?: number | null;
  weight?: number | null;
  owner_id?: string | null;
  update_type?: OkrKrUpdateType;
  frequency?: OkrKrFrequency;
  metric_code?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  allow_overachievement?: boolean;
}

export interface OkrKeyResultV2Update extends OkrKeyResultV2Input {
  lock_version: number;
}

export const OKR_KR_DIRECTION_LABEL: Record<OkrKrDirection, string> = {
  increase: "Aumentar",
  decrease: "Reduzir",
  range: "Manter em faixa",
  boolean: "Sim/Não",
};

export const OKR_KR_UPDATE_TYPE_LABEL: Record<OkrKrUpdateType, string> = {
  manual: "Manual",
  automatic: "Automático",
  hybrid: "Híbrido",
};

export const OKR_KR_LIFECYCLE_LABEL: Record<OkrKrLifecycle, string> = {
  draft: "Rascunho",
  active: "Ativo",
  paused: "Pausado",
  completed: "Concluído",
  cancelled: "Cancelado",
  archived: "Arquivado",
};

export const OKR_KR_UNITS: OkrKrUnit[] = ["%", "un", "pts", "score", "dias", "R$", "bool", "bugs"];