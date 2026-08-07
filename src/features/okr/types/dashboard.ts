export type OkrDashboardMode = "operational" | "executive";

export interface OkrDashboardCycleSummary {
  id: string;
  code: string;
  name: string;
  status: string;
  starts_at: string;
  ends_at: string;
  objectives: number;
  active_objectives: number;
  average_progress: number | null;
  on_track: number;
  attention: number;
  at_risk: number;
  no_data: number;
  key_results: number;
  stale_key_results: number;
}

export interface OkrDashboardTeamSummary {
  cycle_id: string;
  team_id: string | null;
  team_name: string;
  objectives: number;
  average_progress: number | null;
  at_risk: number;
  stale_key_results: number;
}

export interface OkrDashboardFocusObjective {
  id: string;
  cycle_id: string;
  cycle_code: string;
  title: string;
  team_name: string | null;
  lifecycle_status: string;
  health: string;
  progress: number | null;
  key_results: number;
  stale_key_results: number;
}

export interface OkrDashboardOperations {
  open_alerts: number;
  critical_alerts: number;
  blocked_initiatives: number;
  overdue_initiatives: number;
}

export interface OkrDashboardData {
  mode: OkrDashboardMode;
  generated_at: string;
  primary_cycle_id: string | null;
  compare_cycle_id: string | null;
  cycles: OkrDashboardCycleSummary[];
  teams: OkrDashboardTeamSummary[];
  focus_objectives: OkrDashboardFocusObjective[];
  operations: OkrDashboardOperations;
}

export interface OkrExportRowV2 {
  cycle_code: string;
  cycle_name: string;
  team_name: string;
  objective_title: string;
  objective_level: string;
  objective_lifecycle: string;
  objective_health: string;
  objective_progress: number | null;
  key_result_title: string | null;
  key_result_unit: string | null;
  key_result_direction: string | null;
  key_result_baseline: number | null;
  key_result_target: number | null;
  key_result_current: number | null;
  key_result_progress: number | null;
  key_result_health: string | null;
  measurement_quality: string | null;
  last_measured_at: string | null;
}

export interface OkrExportPayloadV2 {
  format: "csv" | "pdf";
  plan_code: string;
  used: number;
  limit: number | null;
  rows: OkrExportRowV2[];
}
