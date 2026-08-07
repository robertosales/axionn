import { supabase } from "@/integrations/supabase/client";

export interface AutomationConfig {
  autoApproveEnabled: boolean;
  minOccurrences: number;
  maxCorrectionRate: number;
  driftAlertEnabled: boolean;
  driftThresholdPp: number;
}

export interface DriftStatus {
  hasDrift: boolean;
  currentAccuracy: number | null;
  previousAccuracy: number | null;
  deltaPp: number | null;
  weeksAnalyzed: number;
}

export interface AutoApproveResult { approved: string[]; skipped: string[] }

export const DEFAULT_AUTOMATION_CONFIG: AutomationConfig = {
  autoApproveEnabled: false,
  minOccurrences: 10,
  maxCorrectionRate: 0.10,
  driftAlertEnabled: true,
  driftThresholdPp: 10,
};

export async function loadAutomationConfig(teamId: string): Promise<AutomationConfig> {
  const { data, error } = await supabase
    .from("apf_automation_settings")
    .select("auto_approve_enabled, min_occurrences, max_correction_rate, drift_alert_enabled, drift_threshold_pp")
    .eq("team_id", teamId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { ...DEFAULT_AUTOMATION_CONFIG };
  return {
    autoApproveEnabled: data.auto_approve_enabled,
    minOccurrences: data.min_occurrences,
    maxCorrectionRate: Number(data.max_correction_rate),
    driftAlertEnabled: data.drift_alert_enabled,
    driftThresholdPp: Number(data.drift_threshold_pp),
  };
}

export async function saveAutomationConfig(teamId: string, config: AutomationConfig): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Sessão inválida");
  const { error } = await supabase.from("apf_automation_settings").upsert({
    team_id: teamId,
    auto_approve_enabled: config.autoApproveEnabled,
    min_occurrences: config.minOccurrences,
    max_correction_rate: config.maxCorrectionRate,
    drift_alert_enabled: config.driftAlertEnabled,
    drift_threshold_pp: config.driftThresholdPp,
    created_by: authData.user.id,
    updated_by: authData.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "team_id" });
  if (error) throw new Error(error.message);
}

export async function runAutoApprove(teamId: string, pendingIds: string[]): Promise<AutoApproveResult> {
  const { data, error } = await supabase.rpc("run_apf_auto_approve", { p_team_id: teamId });
  if (error) throw new Error(error.message);
  const approved = (data ?? []).map((row: { pattern_id: string }) => row.pattern_id);
  const approvedSet = new Set(approved);
  return { approved, skipped: pendingIds.filter((id) => !approvedSet.has(id)) };
}

export async function checkDriftStatus(teamId: string, config: AutomationConfig): Promise<DriftStatus> {
  const { data, error } = await supabase
    .from("apf_learning_metrics")
    .select("week_start, accuracy_rate")
    .eq("team_id", teamId)
    .order("week_start", { ascending: false })
    .limit(2);
  if (error) throw new Error(error.message);
  if (!data || data.length < 2) {
    return { hasDrift: false, currentAccuracy: data?.[0]?.accuracy_rate ?? null, previousAccuracy: null, deltaPp: null, weeksAnalyzed: data?.length ?? 0 };
  }
  const current = Number(data[0].accuracy_rate);
  const previous = Number(data[1].accuracy_rate);
  const deltaPp = current - previous;
  return { hasDrift: config.driftAlertEnabled && deltaPp <= -config.driftThresholdPp, currentAccuracy: current, previousAccuracy: previous, deltaPp, weeksAnalyzed: 2 };
}
