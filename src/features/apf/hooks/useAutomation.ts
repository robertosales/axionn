/**
 * useAutomation
 * --------------
 * Hook de automação progressiva para a Biblioteca APF (Stage 5).
 * Gerencia config, execução de auto-aprovação e status de drift.
 */
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  loadAutomationConfig,
  saveAutomationConfig,
  runAutoApprove,
  checkDriftStatus,
  type AutomationConfig,
  type DriftStatus,
  type AutoApproveResult,
} from "../services/automation.service";
import type { KnowledgePattern } from "../services/knowledge.service";

export function useAutomation(patterns: KnowledgePattern[], onPatternsChanged: () => void) {
  const [config, setConfig]         = useState<AutomationConfig>(loadAutomationConfig);
  const [drift, setDrift]           = useState<DriftStatus | null>(null);
  const [running, setRunning]       = useState(false);
  const [lastRun, setLastRun]       = useState<Date | null>(null);
  const [lastResult, setLastResult] = useState<AutoApproveResult | null>(null);

  // Carrega status de drift ao montar
  useEffect(() => {
    checkDriftStatus(config).then(setDrift).catch(console.warn);
  }, [config.driftAlertEnabled, config.driftThresholdPp]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateConfig = useCallback((partial: Partial<AutomationConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      saveAutomationConfig(next);
      return next;
    });
  }, []);

  const executeAutoApprove = useCallback(async () => {
    if (running) return;
    setRunning(true);
    try {
      const result = await runAutoApprove(patterns, config);
      setLastResult(result);
      setLastRun(new Date());

      if (result.approved.length > 0) {
        toast.success(
          `${result.approved.length} padrão${result.approved.length !== 1 ? "s" : ""} aprovado${result.approved.length !== 1 ? "s" : ""} automaticamente`,
          { description: `${result.skipped.length} não atingiram os critérios configurados.` },
        );
        onPatternsChanged();
      } else {
        toast.info("Nenhum padrão atendeu os critérios para auto-aprovação", {
          description: `Critérios: ≥ ${config.minOccurrences} ocorrências e ≤ ${Math.round(config.maxCorrectionRate * 100)}% de correção.`,
        });
      }
    } catch (err) {
      toast.error("Erro na auto-aprovação", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setRunning(false);
    }
  }, [patterns, config, running, onPatternsChanged]);

  // Candidatos que seriam aprovados com a config atual
  const autoApproveCandidates = patterns.filter(
    (p) =>
      p.status === "auto" &&
      p.occurrence_count  >= config.minOccurrences &&
      p.correction_rate   <= config.maxCorrectionRate,
  );

  return {
    config,
    updateConfig,
    drift,
    running,
    lastRun,
    lastResult,
    autoApproveCandidates,
    executeAutoApprove,
  };
}
