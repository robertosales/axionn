/**
 * useLearningInsights
 * -------------------
 * Hook que carrega o histórico de validações do time e computa
 * os insights de aprendizado (desvio, acurácia, viés, calibração).
 *
 * O calibrationContext gerado é salvo no AiPipelineContext para
 * ser injetado automaticamente nos próximos prompts de contagem de PF.
 */
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchValidationHistory,
  computeLearningInsights,
  type LearningInsights,
} from "../services/learning.service";
import { useAiPipeline } from "../contexts/AiPipelineContext";

export function useLearningInsights() {
  const { currentTeam } = useAuth();
  const teamId = currentTeam?.id ?? "";
  const { setCalibrationContext } = useAiPipeline();

  const [insights, setInsights]   = useState<LearningInsights | null>(null);
  const [loading, setLoading]     = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const records = await fetchValidationHistory(teamId, 200);
      const computed = computeLearningInsights(records);
      setInsights(computed);

      // Injeta contexto de calibração no AiPipelineContext
      setCalibrationContext(computed.calibrationContext);
      setLastRefresh(new Date());
    } catch (err) {
      console.warn("[useLearningInsights] erro ao carregar histórico:", err);
    } finally {
      setLoading(false);
    }
  }, [teamId, setCalibrationContext]);

  // Carrega ao montar e a cada 5 min
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { insights, loading, refresh, lastRefresh };
}
