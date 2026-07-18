import { supabase } from "@/integrations/supabase/client";
import { calculateKrProgress, calculateObjectiveHealth, calculateObjectiveProgress } from "../domain/okrCalculations";
import type { OkrDirection, OkrCheckInInput } from "../types";

export async function recordManualOkrMeasurement(args: {
  keyResultId: string;
  input: OkrCheckInInput;
  authorId: string;
}) {
  const db = supabase as any;
  const { data: kr, error: krError } = await db.from("okr_key_results").select("*").eq("id", args.keyResultId).single();
  if (krError || !kr) throw krError ?? new Error("Key Result não encontrado");
  if (kr.update_type === "automatic") throw new Error("KRs automáticos não aceitam check-in manual.");

  const result = calculateKrProgress({
    baseline: kr.baseline_value,
    current: args.input.value,
    target: kr.target_value ?? kr.target,
    targetMin: kr.target_min,
    targetMax: kr.target_max,
    direction: (kr.direction ?? "increase") as OkrDirection,
  });
  const measuredAt = new Date().toISOString();

  const { error: checkInError } = await db.from("okr_check_ins").insert({
    key_result_id: kr.id,
    objective_id: kr.objective_id,
    value: args.input.value,
    previous_value: kr.current_value ?? kr.current,
    note: args.input.summary,
    summary: args.input.summary,
    confidence: args.input.confidence,
    risks: args.input.risks ?? null,
    next_steps: args.input.nextSteps ?? null,
    evidence: args.input.evidenceUrl ? { url: args.input.evidenceUrl } : {},
    author_id: args.authorId,
  });
  if (checkInError) throw checkInError;

  const { error: updateError } = await db.from("okr_key_results").update({
    current: args.input.value,
    current_value: args.input.value,
    raw_progress: result.rawProgress,
    calculated_progress: result.progress,
    calculated_health: result.progress == null ? "no_data" : result.progress >= 100 ? "completed" : result.progress >= 70 ? "on_track" : "at_risk",
    measurement_quality: "reliable",
    last_measured_at: measuredAt,
    updated_at: measuredAt,
  }).eq("id", kr.id);
  if (updateError) throw updateError;

  const idempotencyKey = `manual:${kr.id}:${measuredAt}`;
  const { error: snapshotError } = await db.from("okr_key_result_snapshots").insert({
    key_result_id: kr.id,
    measured_value: args.input.value,
    raw_progress: result.rawProgress,
    calculated_progress: result.progress,
    health: result.progress == null ? "no_data" : result.progress >= 100 ? "completed" : result.progress >= 70 ? "on_track" : "at_risk",
    measurement_quality: "reliable",
    source: "manual_check_in",
    formula_version: "1.0",
    measured_at: measuredAt,
    scope_type: "team",
    calculation_metadata: { summary: args.input.summary, confidence: args.input.confidence, risks: args.input.risks ?? null, next_steps: args.input.nextSteps ?? null, evidence_url: args.input.evidenceUrl ?? null, baseline: kr.baseline_value, target: kr.target_value ?? kr.target, direction: kr.direction },
    triggered_by_type: "manual",
    triggered_by_id: args.authorId,
    idempotency_key: idempotencyKey,
  });
  if (snapshotError) throw snapshotError;

  await recalculateObjective(kr.objective_id);
}

export async function recalculateObjective(objectiveId: string) {
  const db = supabase as any;
  const [{ data: objective, error: objectiveError }, { data: keyResults, error: krError }] = await Promise.all([
    db.from("okr_objectives").select("*").eq("id", objectiveId).single(),
    db.from("okr_key_results").select("calculated_progress,weight,lifecycle_status").eq("objective_id", objectiveId),
  ]);
  if (objectiveError || krError) throw objectiveError ?? krError;
  const progress = calculateObjectiveProgress((keyResults ?? []).map((kr: any) => ({
    progress: kr.calculated_progress,
    weight: kr.weight,
    active: kr.lifecycle_status === "active",
  })));
  const start = objective.start_date ? new Date(objective.start_date).getTime() : new Date(`${objective.cycle.slice(3)}-01-01`).getTime();
  const end = objective.end_date ? new Date(objective.end_date).getTime() : start + 90 * 86400000;
  const elapsed = end <= start ? 100 : ((Date.now() - start) / (end - start)) * 100;
  const health = calculateObjectiveHealth({ progress: progress.progress, cycleElapsed: elapsed, lifecycleStatus: objective.lifecycle_status });
  const now = new Date().toISOString();
  const { error } = await db.from("okr_objectives").update({
    calculated_progress: progress.progress,
    calculated_health: health.health,
    health_reason: health.reason,
    measurement_status: progress.progress == null ? "needs_configuration" : "measuring",
    last_calculated_at: now,
    updated_at: now,
  }).eq("id", objectiveId);
  if (error) throw error;
}

export async function measureAutomaticKeyResult(keyResultId: string, triggeredById: string) {
  // A medição automática é executada no backend, onde contexto e RLS são
  // validados. O parâmetro é mantido por compatibilidade com os chamadores.
  void triggeredById;
  const { data, error } = await supabase.functions.invoke("okr-recalculation", { body: { keyResultId } });
  if (error) throw error;
  const result = data?.results?.[0];
  if (!result?.ok) throw new Error(result?.error ?? "Não foi possível recalcular o Key Result.");
  return result;
}
