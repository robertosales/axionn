/**
 * learning.service.ts
 * -------------------
 * Serviço de Aprendizado Bidirecional (Fase 4).
 *
 * Fluxo:
 *  1. Quando o usuário VALIDA um PF, o front salva na tabela
 *     `function_point_analyses` com is_validated=true e validated_total_pf.
 *  2. Este serviço consulta esse histórico para:
 *     a. Calcular desvio médio (IA vs Validado)
 *     b. Detectar padrões por tipo de HU (EI/EO/EQ/ILF/EIF dominante)
 *     c. Gerar contexto de calibração para injetar nos próximos prompts
 *  3. O contexto gerado é armazenado no AiPipelineContext e injetado
 *     automaticamente em `generateGeneric` e `countFpForHu`.
 */
import { supabase } from "@/integrations/supabase/client";

// ── Tipos ───────────────────────────────────────────────────────────────────
export interface FpAnalysisRecord {
  id: string;
  story_id: string;
  story_code: string | null;
  story_title: string | null;
  sprint_id: string | null;
  team_id: string;
  ai_total_pf: number;
  validated_total_pf: number | null;
  is_validated: boolean;
  deviation_pct: number | null;  // (validated - ai) / ai * 100
  breakdown: Record<string, number> | null;
  confidence: number | null;
  created_at: string;
  validated_at: string | null;
}

export interface LearningInsights {
  /** Total de validações disponíveis */
  totalValidations: number;
  /** Desvio médio percentual: positivo = IA subestimou, negativo = superestimou */
  avgDeviationPct: number;
  /** Desvio absoluto médio em PF */
  avgDeviationAbs: number;
  /** Acurácia: % de casos com desvio <= 15% */
  accuracyRate: number;
  /** Tendência: "underestimate" | "overestimate" | "calibrated" */
  bias: "underestimate" | "overestimate" | "calibrated";
  /** Componente IFPUG com maior desvio acumulado */
  worstComponent: string | null;
  /** Histórico simplificado para sparkline (últimos 20) */
  history: Array<{ code: string; ai: number; validated: number; deviationPct: number }>;
  /** Prompt de calibração para injetar antes das contagens futuras */
  calibrationContext: string;
}

// ── Busca histórico de validações do time ───────────────────────────────────
export async function fetchValidationHistory(
  teamId: string,
  limit = 100,
): Promise<FpAnalysisRecord[]> {
  const { data, error } = await supabase
    .from("function_point_analyses" as any)
    .select("*")
    .eq("team_id", teamId)
    .eq("is_validated", true)
    .order("validated_at", { ascending: false })
    .limit(limit);

  if (error) {
    // Tabela pode não existir ainda no banco (migration pendente)
    console.warn("[learning] function_point_analyses não disponível:", error.message);
    return [];
  }
  return (data ?? []) as FpAnalysisRecord[];
}

// ── Busca validações de uma sprint específica ───────────────────────────────
export async function fetchSprintValidations(
  teamId: string,
  sprintId: string,
): Promise<FpAnalysisRecord[]> {
  const { data, error } = await supabase
    .from("function_point_analyses" as any)
    .select("*")
    .eq("team_id", teamId)
    .eq("sprint_id", sprintId)
    .order("created_at", { ascending: true });

  if (error) { console.warn("[learning] sprint validations error:", error.message); return []; }
  return (data ?? []) as FpAnalysisRecord[];
}

// ── Salva/atualiza uma validação de PF ───────────────────────────────────────
export async function saveValidation(payload: {
  teamId: string;
  storyId: string;
  storyCode?: string | null;
  storyTitle?: string | null;
  sprintId?: string | null;
  aiTotalPf: number;
  validatedTotalPf: number;
  breakdown?: Record<string, number> | null;
  confidence?: number | null;
}): Promise<void> {
  const deviationPct = payload.aiTotalPf > 0
    ? ((payload.validatedTotalPf - payload.aiTotalPf) / payload.aiTotalPf) * 100
    : 0;

  const record = {
    team_id:             payload.teamId,
    story_id:            payload.storyId,
    story_code:          payload.storyCode ?? null,
    story_title:         payload.storyTitle ?? null,
    sprint_id:           payload.sprintId ?? null,
    ai_total_pf:         payload.aiTotalPf,
    validated_total_pf:  payload.validatedTotalPf,
    is_validated:        true,
    deviation_pct:       Number(deviationPct.toFixed(2)),
    breakdown:           payload.breakdown ?? null,
    confidence:          payload.confidence ?? null,
    validated_at:        new Date().toISOString(),
  };

  // Upsert: uma HU pode ter múltiplas validações ao longo do tempo
  const { error } = await supabase
    .from("function_point_analyses" as any)
    .upsert(record as any, { onConflict: "story_id" });

  if (error) console.warn("[learning] saveValidation error:", error.message);
}

// ── Calcula insights a partir do histórico ───────────────────────────────────
export function computeLearningInsights(records: FpAnalysisRecord[]): LearningInsights {
  const validated = records.filter(
    (r) => r.is_validated && r.validated_total_pf != null && r.ai_total_pf != null
  );

  if (validated.length === 0) {
    return {
      totalValidations: 0,
      avgDeviationPct: 0,
      avgDeviationAbs: 0,
      accuracyRate: 0,
      bias: "calibrated",
      worstComponent: null,
      history: [],
      calibrationContext: "",
    };
  }

  // Desvios
  const deviations = validated.map((r) => ({
    code:         r.story_code ?? r.story_id.slice(0, 8),
    ai:           r.ai_total_pf,
    validated:    r.validated_total_pf!,
    deviationPct: r.deviation_pct ?? ((r.validated_total_pf! - r.ai_total_pf) / r.ai_total_pf * 100),
    deviationAbs: Math.abs(r.validated_total_pf! - r.ai_total_pf),
    breakdown:    r.breakdown ?? {},
  }));

  const avgDeviationPct = deviations.reduce((s, d) => s + d.deviationPct, 0) / deviations.length;
  const avgDeviationAbs = deviations.reduce((s, d) => s + d.deviationAbs, 0) / deviations.length;
  const accurate        = deviations.filter((d) => Math.abs(d.deviationPct) <= 15).length;
  const accuracyRate    = (accurate / deviations.length) * 100;

  const bias: LearningInsights["bias"] =
    avgDeviationPct >  10 ? "underestimate" :
    avgDeviationPct < -10 ? "overestimate"  : "calibrated";

  // Componente IFPUG com maior erro acumulado
  const componentErrors: Record<string, number> = {};
  deviations.forEach((d) => {
    Object.entries(d.breakdown).forEach(([k, v]) => {
      if (["EI","EO","EQ","ILF","EIF"].includes(k)) {
        componentErrors[k] = (componentErrors[k] ?? 0) + Math.abs(d.deviationAbs);
      }
    });
  });
  const worstComponent = Object.keys(componentErrors).length > 0
    ? Object.entries(componentErrors).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  // Histórico para sparkline (últimos 20 cronologicamente)
  const history = deviations.slice(-20).map((d) => ({
    code:         d.code,
    ai:           d.ai,
    validated:    d.validated,
    deviationPct: Number(d.deviationPct.toFixed(1)),
  }));

  // Prompt de calibração para injetar na IA
  const calibrationContext = buildCalibrationContext({
    totalValidations: validated.length,
    avgDeviationPct,
    avgDeviationAbs,
    accuracyRate,
    bias,
    worstComponent,
  });

  return {
    totalValidations: validated.length,
    avgDeviationPct: Number(avgDeviationPct.toFixed(1)),
    avgDeviationAbs: Number(avgDeviationAbs.toFixed(1)),
    accuracyRate:    Number(accuracyRate.toFixed(1)),
    bias,
    worstComponent,
    history,
    calibrationContext,
  };
}

// ── Gera texto de calibração para injetar no próximo prompt ─────────────────
function buildCalibrationContext(params: {
  totalValidations: number;
  avgDeviationPct: number;
  avgDeviationAbs: number;
  accuracyRate: number;
  bias: string;
  worstComponent: string | null;
}): string {
  if (params.totalValidations < 3) return ""; // não há dados suficientes

  const lines: string[] = [
    `--- CONTEXTO DE CALIBRAÇÃO (baseado em ${params.totalValidations} validações históricas) ---`,
  ];

  if (params.bias === "underestimate") {
    lines.push(
      `ATENÇÃO: historicamente este time tem HUs que geram +${params.avgDeviationPct.toFixed(1)}% de PF em relação à estimativa inicial.`,
      `Ajuste seus valores de PF para CIMA em aproximadamente ${Math.round(params.avgDeviationPct)}% em relação à sua estimativa base.`
    );
  } else if (params.bias === "overestimate") {
    lines.push(
      `ATENÇÃO: historicamente este time tem HUs com ${Math.abs(params.avgDeviationPct).toFixed(1)}% a MENOS de PF do que a estimativa inicial.`,
      `Ajuste seus valores de PF para BAIXO em aproximadamente ${Math.round(Math.abs(params.avgDeviationPct))}% em relação à sua estimativa base.`
    );
  } else {
    lines.push(`A calibração histórica indica estimativas próximas do real (desvio médio: ${params.avgDeviationPct.toFixed(1)}%). Mantenha a precisão atual.`);
  }

  if (params.worstComponent) {
    lines.push(`Componente com maior histórico de erro: ${params.worstComponent}. Revise cuidadosamente as condições para classificação deste tipo.`);
  }

  lines.push(
    `Acurácia histórica (desvio <= 15%): ${params.accuracyRate.toFixed(1)}%.`,
    `--- FIM DO CONTEXTO DE CALIBRAÇÃO ---`
  );

  return lines.join("\n");
}
