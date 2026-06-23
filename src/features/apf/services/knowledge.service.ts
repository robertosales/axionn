/**
 * knowledge.service.ts
 * ---------------------
 * Serviço de acesso ao banco para a Biblioteca APF (Stage 4).
 * Lê apf_knowledge_patterns e apf_learning_metrics do Supabase.
 */
import { supabase } from "@/integrations/supabase/client";

export type PatternStatus = "auto" | "validated" | "rejected";

export interface KnowledgePattern {
  id: string;
  pattern_key: string;
  functional_type: string;
  complexity: string;
  domain: string | null;
  avg_pf_bruto: number | null;
  occurrence_count: number;
  correction_rate: number;
  top_correction_reason: string | null;
  status: PatternStatus;
  created_at: string;
  updated_at: string;
}

export interface LearningMetric {
  week_start: string;
  total_validations: number;
  corrected_count: number;
  accuracy_rate: number;
  rag_accuracy_with: number | null;
  rag_accuracy_without: number | null;
  avg_confidence_score: number | null;
}

export interface KnowledgeStats {
  totalPatterns: number;
  validatedPatterns: number;
  pendingPatterns: number;
  latestAccuracy: number | null;
  ragDelta: number | null; // rag_accuracy_with - rag_accuracy_without
  totalValidations: number;
}

export async function fetchKnowledgePatterns(
  status?: PatternStatus,
  domain?: string,
): Promise<KnowledgePattern[]> {
  let query = supabase
    .from("apf_knowledge_patterns")
    .select("*")
    .order("occurrence_count", { ascending: false });

  if (status) query = query.eq("status", status);
  if (domain) query = query.eq("domain", domain);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as KnowledgePattern[];
}

export async function updatePatternStatus(
  id: string,
  status: PatternStatus,
): Promise<void> {
  const { error } = await supabase
    .from("apf_knowledge_patterns")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchLearningMetrics(limit = 12): Promise<LearningMetric[]> {
  const { data, error } = await supabase
    .from("apf_learning_metrics")
    .select("week_start, total_validations, corrected_count, accuracy_rate, rag_accuracy_with, rag_accuracy_without, avg_confidence_score")
    .order("week_start", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as LearningMetric[]).reverse(); // cronológico
}

export async function fetchKnowledgeStats(): Promise<KnowledgeStats> {
  const [patterns, metrics] = await Promise.all([
    fetchKnowledgePatterns(),
    fetchLearningMetrics(1),
  ]);

  const latest = metrics[0] ?? null;
  const ragDelta =
    latest?.rag_accuracy_with != null && latest?.rag_accuracy_without != null
      ? latest.rag_accuracy_with - latest.rag_accuracy_without
      : null;

  return {
    totalPatterns:     patterns.length,
    validatedPatterns: patterns.filter((p) => p.status === "validated").length,
    pendingPatterns:   patterns.filter((p) => p.status === "auto").length,
    latestAccuracy:    latest?.accuracy_rate ?? null,
    ragDelta,
    totalValidations:  latest?.total_validations ?? 0,
  };
}
