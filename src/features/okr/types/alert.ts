export type OkrAlertStatus = "open" | "acknowledged" | "resolved";
export type OkrAlertSeverity = "low" | "medium" | "high" | "critical";

export const OKR_ALERT_STATUS_LABEL: Record<OkrAlertStatus, string> = {
  open: "Aberto",
  acknowledged: "Reconhecido",
  resolved: "Resolvido",
};

export const OKR_ALERT_RULE_LABEL: Record<string, string> = {
  "objective.no_owner": "Objective sem responsável",
  "objective.no_alignment": "Objective sem alinhamento",
  "kr.no_baseline": "KR sem linha de base",
  "kr.no_measurement": "KR sem medição",
  "kr.stale_measurement": "Medição desatualizada",
  "initiative.blocked": "Iniciativa bloqueada",
  "initiative.overdue": "Iniciativa vencida",
};

export interface OkrAlertV2 {
  id: string;
  organization_id: string | null;
  cycle_id: string | null;
  objective_id: string | null;
  key_result_id: string | null;
  initiative_id: string | null;
  rule_code: string | null;
  alert_type: string | null;
  severity: OkrAlertSeverity;
  message: string | null;
  status: OkrAlertStatus;
  occurrence_count: number | null;
  first_detected_at: string | null;
  last_detected_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
}