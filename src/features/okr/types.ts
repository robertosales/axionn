// ---------------------------------------------------------------------------
// OKR Types
// ---------------------------------------------------------------------------

export type OkrStatus = "on_track" | "at_risk" | "off_track" | "completed";
export type OkrUpdateType = "automatic" | "manual" | "hybrid";
export type OkrDirection = "increase" | "decrease" | "range";
export type OkrHealth = "on_track" | "attention" | "at_risk" | "no_data" | "completed";

// Valores aceitos pelo CHECK constraint da tabela okr_key_results
export type OkrKeyResultUnit = "%" | "pts" | "bugs" | "score" | "dias" | "bool" | "R$" | "un";

export interface OkrCheckIn {
  id: string;
  key_result_id: string;
  value: number;
  note: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

export interface OkrKeyResult {
  id: string;
  objective_id: string;
  title: string;
  unit: OkrKeyResultUnit;
  target: number;
  current: number;
  baseline_value?: number | null;
  current_value?: number | null;
  target_value?: number | null;
  target_min?: number | null;
  target_max?: number | null;
  direction?: OkrDirection;
  update_type?: OkrUpdateType;
  metric_code?: string | null;
  source_label?: string | null;
  raw_progress?: number | null;
  calculated_progress?: number | null;
  calculated_health?: OkrHealth;
  measurement_quality?: "reliable" | "partial" | "stale" | "no_data" | "error";
  last_measured_at?: string | null;
  weight?: number | null;
  check_ins: OkrCheckIn[];
  created_at: string;
  updated_at?: string;
}

export interface OkrObjective {
  id: string;
  team_id: string;
  team_name?: string;
  owner_id: string;
  owner_name?: string;
  title: string;
  description: string;
  cycle: string;
  status: OkrStatus;
  progress: number;
  calculated_progress?: number | null;
  calculated_health?: OkrHealth;
  health_reason?: string | null;
  manual_health_override?: OkrHealth | null;
  health_override_reason?: string | null;
  lifecycle_status?: "draft" | "active" | "completed" | "cancelled" | "archived";
  start_date?: string | null;
  end_date?: string | null;
  last_calculated_at?: string | null;
  measurement_status?: "needs_configuration" | "configured" | "measuring";
  legacy_progress?: number | null;
  key_results: OkrKeyResult[];
  created_at: string;
  updated_at?: string;
}

export interface OkrFilters {
  cycle: string;
  teamId: string;
}

export interface OkrObjectiveInput {
  title: string;
  description?: string;
  cycle: string;
  team_id: string;
  owner_id?: string;
  lifecycle_status?: OkrObjective["lifecycle_status"];
  start_date?: string | null;
  end_date?: string | null;
  manual_health_override?: OkrHealth | null;
  health_override_reason?: string | null;
}

export interface OkrCheckInInput {
  value: number;
  summary: string;
  confidence: number;
  risks?: string;
  nextSteps?: string;
  evidenceUrl?: string;
}

export interface OkrSnapshot {
  id: string;
  key_result_id: string;
  measured_value: number | null;
  raw_progress: number | null;
  calculated_progress: number | null;
  health: string;
  measurement_quality: string;
  source: string | null;
  formula_version: string | null;
  measured_at: string;
  period_start: string | null;
  period_end: string | null;
  items_considered: number | null;
  calculation_metadata: Record<string, unknown>;
}

export interface OkrInitiative {
  id: string;
  objective_id: string;
  key_result_id: string | null;
  title: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  due_date: string | null;
  created_at: string;
}
