import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  loadAutomationConfig, saveAutomationConfig, runAutoApprove, checkDriftStatus,
  DEFAULT_AUTOMATION_CONFIG, type AutomationConfig, type DriftStatus, type AutoApproveResult,
} from "../services/automation.service";
import type { KnowledgePattern } from "../services/knowledge.service";

export function useAutomation(patterns: KnowledgePattern[], onPatternsChanged: () => void) {
  const { currentTeamId } = useAuth();
  const [config, setConfig] = useState<AutomationConfig>({ ...DEFAULT_AUTOMATION_CONFIG });
  const [drift, setDrift] = useState<DriftStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [lastResult, setLastResult] = useState<AutoApproveResult | null>(null);
  const [configReadyForTeam, setConfigReadyForTeam] = useState<string | null>(null);

  useEffect(() => {
    setConfigReadyForTeam(null);
    if (!currentTeamId) { setConfig({ ...DEFAULT_AUTOMATION_CONFIG }); return; }
    loadAutomationConfig(currentTeamId).then((loaded) => {
      setConfig(loaded);
      setConfigReadyForTeam(currentTeamId);
    }).catch((error) => {
      toast.error("Erro ao carregar configuração da automação", { description: error.message });
    });
  }, [currentTeamId]);

  useEffect(() => {
    if (!currentTeamId || configReadyForTeam !== currentTeamId) return;
    const timer = window.setTimeout(() => {
      saveAutomationConfig(currentTeamId, config).catch((error) => {
        toast.error("Erro ao salvar configuração da automação", { description: error.message });
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [config, configReadyForTeam, currentTeamId]);

  useEffect(() => {
    if (!currentTeamId) { setDrift(null); return; }
    checkDriftStatus(currentTeamId, config).then(setDrift).catch(console.warn);
  }, [currentTeamId, config.driftAlertEnabled, config.driftThresholdPp]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateConfig = useCallback((partial: Partial<AutomationConfig>) => {
    setConfig((previous) => ({ ...previous, ...partial }));
  }, []);

  const executeAutoApprove = useCallback(async () => {
    if (running) return;
    setRunning(true);
    try {
      if (!currentTeamId) throw new Error("Selecione um time antes de executar a automação");
      await saveAutomationConfig(currentTeamId, config);
      const pendingIds = patterns.filter((pattern) => pattern.status === "auto").map((pattern) => pattern.id);
      const result = await runAutoApprove(currentTeamId, pendingIds);
      setLastResult(result);
      setLastRun(new Date());
      if (result.approved.length > 0) {
        toast.success(`${result.approved.length} padrão${result.approved.length !== 1 ? "s" : ""} aprovado${result.approved.length !== 1 ? "s" : ""} automaticamente`,
          { description: `${result.skipped.length} não atingiram os critérios configurados.` });
        onPatternsChanged();
      } else {
        toast.info("Nenhum padrão atendeu os critérios para auto-aprovação");
      }
    } catch (error) {
      toast.error("Erro na auto-aprovação", { description: error instanceof Error ? error.message : "Erro desconhecido" });
    } finally { setRunning(false); }
  }, [patterns, config, running, onPatternsChanged, currentTeamId]);

  const autoApproveCandidates = patterns.filter((pattern) => pattern.status === "auto"
    && pattern.occurrence_count >= config.minOccurrences
    && pattern.correction_rate <= config.maxCorrectionRate);

  return { config, updateConfig, drift, running, lastRun, lastResult, autoApproveCandidates, executeAutoApprove };
}
