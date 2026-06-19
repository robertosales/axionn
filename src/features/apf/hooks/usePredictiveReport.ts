/**
 * usePredictiveReport
 * --------------------
 * Hook que carrega o histórico de sprints, computa a regressão linear,
 * scores de complexidade da sprint selecionada e anomalias.
 * Exposto para o painel Predictive.
 */
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchSprintPfHistory,
  linearRegression,
  computeComplexityScores,
  detectAnomalies,
  type PredictiveReport,
  type PredictionResult,
} from "../services/predictive.service";
import { useAiPipeline } from "../contexts/AiPipelineContext";

export function usePredictiveReport() {
  const { currentTeam } = useAuth();
  const teamId = currentTeam?.id ?? "";
  const { activePipelineSprintId } = useAiPipeline();

  const [report, setReport]         = useState<PredictiveReport | null>(null);
  const [loading, setLoading]       = useState(false);
  const [inputSp, setInputSp]       = useState<number>(50);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const history = await fetchSprintPfHistory(teamId, 20);

      const complexities = activePipelineSprintId
        ? await computeComplexityScores(teamId, activePipelineSprintId)
        : [];

      const anomalies = detectAnomalies(history, complexities);

      setReport({
        sprintHistory: history,
        prediction:    null,
        complexities,
        anomalies,
        generatedAt:   new Date().toISOString(),
      });
    } catch (err) {
      console.warn("[usePredictiveReport] erro:", err);
    } finally {
      setLoading(false);
    }
  }, [teamId, activePipelineSprintId]);

  useEffect(() => { load(); }, [load]);

  // Recalcula predição sempre que inputSp ou histórico mudar
  useEffect(() => {
    if (!report?.sprintHistory.length) { setPrediction(null); return; }
    const result = linearRegression(report.sprintHistory, inputSp);
    setPrediction(result);
  }, [report, inputSp]);

  return { report, prediction, loading, inputSp, setInputSp, reload: load };
}
