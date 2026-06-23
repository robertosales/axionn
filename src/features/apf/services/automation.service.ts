/**
 * automation.service.ts
 * ----------------------
 * Serviço de automação progressiva da Biblioteca APF (Stage 5).
 *
 * Responsabilidades:
 *  1. Auto-aprovação: padrões com alta ocorrência + baixa taxa de correção
 *     são aprovados automaticamente sem intervenção humana.
 *  2. Drift detection: compara acurácia das últimas 2 semanas e dispara
 *     alerta se a queda superar o threshold configurado.
 *  3. Persistência de config: salva threshold por team_id no localStorage
 *     (leve, sem nova tabela — migrar para DB quando necessário).
 */
import { supabase } from "@/integrations/supabase/client";
import type { KnowledgePattern } from "./knowledge.service";

// ──────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────
export interface AutomationConfig {
  autoApproveEnabled:    boolean;
  minOccurrences:        number;  // mínimo de ocorrências para auto-aprovar
  maxCorrectionRate:     number;  // máximo de taxa de correção (0-1) para auto-aprovar
  driftAlertEnabled:     boolean;
  driftThresholdPp:      number;  // queda em pp que dispara alerta (ex: 10 = -10pp)
}

export interface DriftStatus {
  hasDrift:      boolean;
  currentAccuracy:  number | null;
  previousAccuracy: number | null;
  deltaPp:       number | null;   // negativo = queda
  weeksAnalyzed: number;
}

export interface AutoApproveResult {
  approved: string[];  // ids aprovados
  skipped:  string[];  // ids ignorados (critério não atingido)
}

// ──────────────────────────────────────────────────────────────
// Config (localStorage por ora)
// ──────────────────────────────────────────────────────────────
const CONFIG_KEY = "apf_automation_config";

const DEFAULT_CONFIG: AutomationConfig = {
  autoApproveEnabled:  false,   // OFF por padrão — especialista deve ativar
  minOccurrences:      10,
  maxCorrectionRate:   0.10,    // <= 10% de correção
  driftAlertEnabled:   true,
  driftThresholdPp:    10,      // alerta se cair >= 10 pp
};

export function loadAutomationConfig(): AutomationConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveAutomationConfig(config: AutomationConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// ──────────────────────────────────────────────────────────────
// Auto-aprovação
// ──────────────────────────────────────────────────────────────
/**
 * Avalia quais padrões "auto" atendem os critérios e os aprova em lote.
 * Retorna ids aprovados e ignorados para feedback visual.
 */
export async function runAutoApprove(
  patterns: KnowledgePattern[],
  config: AutomationConfig,
): Promise<AutoApproveResult> {
  const candidates = patterns.filter((p) => p.status === "auto");
  const toApprove  = candidates.filter(
    (p) =>
      p.occurrence_count  >= config.minOccurrences &&
      p.correction_rate   <= config.maxCorrectionRate,
  );
  const toSkip = candidates.filter(
    (p) =>
      p.occurrence_count  < config.minOccurrences ||
      p.correction_rate   > config.maxCorrectionRate,
  );

  if (toApprove.length === 0) {
    return { approved: [], skipped: toSkip.map((p) => p.id) };
  }

  const ids = toApprove.map((p) => p.id);
  const { error } = await supabase
    .from("apf_knowledge_patterns")
    .update({ status: "validated", updated_at: new Date().toISOString() })
    .in("id", ids);

  if (error) throw new Error(error.message);

  return { approved: ids, skipped: toSkip.map((p) => p.id) };
}

// ──────────────────────────────────────────────────────────────
// Drift Detection
// ──────────────────────────────────────────────────────────────
/**
 * Compara as últimas duas semanas de métricas.
 * Retorna DriftStatus com hasDrift=true se a queda superar o threshold.
 */
export async function checkDriftStatus(
  config: AutomationConfig,
): Promise<DriftStatus> {
  const { data, error } = await supabase
    .from("apf_learning_metrics")
    .select("week_start, accuracy_rate")
    .order("week_start", { ascending: false })
    .limit(2);

  if (error || !data || data.length < 2) {
    return {
      hasDrift:         false,
      currentAccuracy:  data?.[0]?.accuracy_rate ?? null,
      previousAccuracy: null,
      deltaPp:          null,
      weeksAnalyzed:    data?.length ?? 0,
    };
  }

  const current  = data[0].accuracy_rate as number;
  const previous = data[1].accuracy_rate as number;
  const deltaPp  = current - previous;

  return {
    hasDrift:         config.driftAlertEnabled && deltaPp <= -(config.driftThresholdPp),
    currentAccuracy:  current,
    previousAccuracy: previous,
    deltaPp,
    weeksAnalyzed:    2,
  };
}
