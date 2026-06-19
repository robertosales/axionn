/**
 * predictive.service.ts
 * ----------------------
 * APF Preditivo (Fase 5)
 *
 * Responsabilidades:
 *  1. Buscar histórico de sprints + PF validados para treinar o modelo
 *  2. Calcular regressaão linear simples SP → PF
 *  3. Estimar PF de uma sprint futura a partir de SP planejados
 *  4. Detectar anomalias (HUs ou sprints fora do padrão \u00b12σ)
 *  5. Calcular índice de complexidade por HU
 */
import { supabase } from "@/integrations/supabase/client";

// ── Tipos ───────────────────────────────────────────────────────────────────

export interface SprintHistoryPoint {
  sprintId:   string;
  sprintName: string;
  totalSp:    number;
  totalPf:    number;
  huCount:    number;
  pfPerSp:    number;   // razão PF/SP (eficiência)
  pfPerHu:    number;   // PF médio por HU
}

export interface PredictionResult {
  /** SP totais de entrada */
  inputSp: number;
  /** PF estimado via regressão */
  estimatedPf: number;
  /** Intervalo de confiança 80% */
  ci80Low:  number;
  ci80High: number;
  /** R² do modelo (qualidade) */
  r2: number;
  /** Número de sprints usadas para o modelo */
  sampleSize: number;
  /** Inclinação da reta (PF por SP) */
  slope: number;
  /** Intercepto */
  intercept: number;
  /** Avaliação do modelo */
  modelQuality: "excellent" | "good" | "weak" | "insufficient";
}

export interface ComplexityScore {
  huId:    string;
  huCode:  string;
  huTitle: string;
  sp:      number | null;
  fp:      number | null;
  /** PF por SP: quanto maior, mais complexa a HU */
  pfPerSp: number | null;
  /** Z-score em relação à média do time */
  zScore:  number | null;
  /** Classificação de complexidade */
  complexity: "low" | "medium" | "high" | "anomaly";
}

export interface AnomalyAlert {
  type: "hu_outlier" | "sprint_outlier" | "ratio_drift";
  severity: "warning" | "critical";
  title: string;
  description: string;
  entityId: string;
  entityName: string;
  value: number;
  expectedRange: [number, number];
}

export interface PredictiveReport {
  sprintHistory:  SprintHistoryPoint[];
  prediction:     PredictionResult | null;
  complexities:   ComplexityScore[];
  anomalies:      AnomalyAlert[];
  generatedAt:    string;
}

// ── Busca histórico de sprints com PF validado ────────────────────────────
export async function fetchSprintPfHistory(
  teamId: string,
  limit = 20,
): Promise<SprintHistoryPoint[]> {
  // Busca sprints
  const { data: sprintData, error: sprintError } = await supabase
    .from("sprints")
    .select("id, name")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sprintError || !sprintData?.length) return [];

  const points: SprintHistoryPoint[] = [];

  for (const sprint of sprintData) {
    const { data: stories } = await supabase
      .from("user_stories")
      .select("story_points, function_points, ai_fp_validated")
      .eq("team_id", teamId)
      .eq("sprint_id", sprint.id)
      .not("function_points", "is", null);

    if (!stories || stories.length === 0) continue;

    const totalSp = stories.reduce((s: number, h: any) => s + (h.story_points ?? 0), 0);
    const totalPf = stories.reduce((s: number, h: any) => s + (h.function_points ?? 0), 0);
    const huCount = stories.length;

    if (totalSp === 0 || totalPf === 0) continue;

    points.push({
      sprintId:   sprint.id,
      sprintName: sprint.name,
      totalSp,
      totalPf,
      huCount,
      pfPerSp:    Number((totalPf / totalSp).toFixed(3)),
      pfPerHu:    Number((totalPf / huCount).toFixed(2)),
    });
  }

  return points.reverse(); // ordem cronológica
}

// ── Regressão linear simples (SP → PF) ──────────────────────────────────
export function linearRegression(
  points: SprintHistoryPoint[],
  inputSp: number,
): PredictionResult | null {
  const n = points.length;
  if (n < 2) return null;

  const xs = points.map((p) => p.totalSp);
  const ys = points.map((p) => p.totalPf);

  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;

  const ssXX = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  const ssXY = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
  const ssYY = ys.reduce((s, y) => s + (y - yMean) ** 2, 0);

  if (ssXX === 0) return null;

  const slope     = ssXY / ssXX;
  const intercept = yMean - slope * xMean;
  const r2        = ssXX > 0 && ssYY > 0 ? (ssXY ** 2) / (ssXX * ssYY) : 0;

  const estimatedPf = Math.max(0, slope * inputSp + intercept);

  // Erro padrão dos resíduos
  const residuals = points.map((p) => p.totalPf - (slope * p.totalSp + intercept));
  const se        = Math.sqrt(residuals.reduce((s, r) => s + r ** 2, 0) / Math.max(1, n - 2));

  // IC 80% (z ≈ 1.28)
  const margin = 1.28 * se;

  const modelQuality: PredictionResult["modelQuality"] =
    n < 3        ? "insufficient" :
    r2 >= 0.85   ? "excellent"    :
    r2 >= 0.65   ? "good"         : "weak";

  return {
    inputSp,
    estimatedPf:  Number(estimatedPf.toFixed(1)),
    ci80Low:      Number(Math.max(0, estimatedPf - margin).toFixed(1)),
    ci80High:     Number((estimatedPf + margin).toFixed(1)),
    r2:           Number(r2.toFixed(3)),
    sampleSize:   n,
    slope:        Number(slope.toFixed(4)),
    intercept:    Number(intercept.toFixed(2)),
    modelQuality,
  };
}

// ── Índice de complexidade por HU ───────────────────────────────────────────
export async function computeComplexityScores(
  teamId: string,
  sprintId: string,
): Promise<ComplexityScore[]> {
  const { data, error } = await supabase
    .from("user_stories")
    .select("id, code, title, story_points, function_points")
    .eq("team_id", teamId)
    .eq("sprint_id", sprintId)
    .not("function_points", "is", null);

  if (error || !data?.length) return [];

  const ratios = data
    .filter((h: any) => h.story_points && h.function_points)
    .map((h: any) => (h.function_points as number) / (h.story_points as number));

  if (ratios.length === 0) return [];

  const mean  = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const std   = Math.sqrt(ratios.reduce((s, r) => s + (r - mean) ** 2, 0) / ratios.length);

  return data.map((h: any): ComplexityScore => {
    const sp  = h.story_points as number | null;
    const fp  = h.function_points as number | null;
    const pfPerSp = sp && fp ? fp / sp : null;
    const zScore  = pfPerSp !== null && std > 0 ? (pfPerSp - mean) / std : null;

    const complexity: ComplexityScore["complexity"] =
      zScore === null        ? "medium"  :
      Math.abs(zScore) > 2  ? "anomaly"  :
      zScore > 1             ? "high"     :
      zScore < -1            ? "low"      : "medium";

    return {
      huId:    h.id,
      huCode:  h.code,
      huTitle: h.title,
      sp,
      fp,
      pfPerSp: pfPerSp !== null ? Number(pfPerSp.toFixed(2)) : null,
      zScore:  zScore  !== null ? Number(zScore.toFixed(2))  : null,
      complexity,
    };
  });
}

// ── Detector de anomalias ────────────────────────────────────────────────────
export function detectAnomalies(
  history:      SprintHistoryPoint[],
  complexities: ComplexityScore[],
): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];

  if (history.length >= 3) {
    // Verifica drift de razão PF/SP entre sprints recentes
    const ratios = history.map((h) => h.pfPerSp);
    const mean   = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const std    = Math.sqrt(ratios.reduce((s, r) => s + (r - mean) ** 2, 0) / ratios.length);

    // Sprint outliers
    history.forEach((sp) => {
      const z = std > 0 ? Math.abs((sp.pfPerSp - mean) / std) : 0;
      if (z > 2) {
        alerts.push({
          type:     "sprint_outlier",
          severity: z > 3 ? "critical" : "warning",
          title:    `Sprint fora do padrão`,
          description: `${sp.sprintName}: razão PF/SP = ${sp.pfPerSp} (esperado ${(mean - std).toFixed(2)}–${(mean + std).toFixed(2)})`,
          entityId:    sp.sprintId,
          entityName:  sp.sprintName,
          value:       sp.pfPerSp,
          expectedRange: [Number((mean - std).toFixed(2)), Number((mean + std).toFixed(2))],
        });
      }
    });

    // Drift recente: últimas 2 vs média histórica
    if (history.length >= 4) {
      const recent  = history.slice(-2).reduce((s, h) => s + h.pfPerSp, 0) / 2;
      const older   = history.slice(0, -2).reduce((s, h) => s + h.pfPerSp, 0) / (history.length - 2);
      const driftPct = older > 0 ? Math.abs((recent - older) / older) * 100 : 0;
      if (driftPct > 30) {
        alerts.push({
          type:      "ratio_drift",
          severity:  driftPct > 50 ? "critical" : "warning",
          title:     "Drift de eficiência detectado",
          description: `A razão PF/SP recente (${recent.toFixed(2)}) divergiu ${driftPct.toFixed(0)}% da média histórica (${older.toFixed(2)}).`,
          entityId:    "ratio_drift",
          entityName:  "Tendência geral",
          value:       Number(recent.toFixed(2)),
          expectedRange: [Number((older * 0.7).toFixed(2)), Number((older * 1.3).toFixed(2))],
        });
      }
    }
  }

  // HU anomalias
  complexities
    .filter((c) => c.complexity === "anomaly")
    .forEach((c) => {
      alerts.push({
        type:     "hu_outlier",
        severity: Math.abs(c.zScore ?? 0) > 3 ? "critical" : "warning",
        title:    `HU com complexidade anômala`,
        description: `${c.huCode}: ${c.fp} PF / ${c.sp} SP (razão ${c.pfPerSp}) — z-score ${c.zScore}`,
        entityId:    c.huId,
        entityName:  c.huCode,
        value:       c.pfPerSp ?? 0,
        expectedRange: [0, 0],
      });
    });

  return alerts;
}
