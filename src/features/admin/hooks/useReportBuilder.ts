import { useMemo } from "react";
import type { AdminKpis } from "./useAdminKpis";
import type { SprintMetrics, TeamComparativo, PeriodoFiltro } from "./useSprintHistory";

export interface ReportConfig {
  teamId:             string;    // "all" | teamId
  teamLabel:          string;
  periodo:            PeriodoFiltro;
  periodoLabel:       string;
  includeKpis:        boolean;
  includeSprints:     boolean;
  includeComparativo: boolean;
  includeImpedimentos:boolean;
}

export interface ReportPayload {
  config:      ReportConfig;
  kpis:        AdminKpis["global"] | null;
  sprints:     SprintMetrics[];
  comparativo: TeamComparativo[];
}

const PERIODO_LABELS: Record<PeriodoFiltro, string> = {
  "3m":  "Últimos 3 meses",
  "6m":  "Últimos 6 meses",
  "12m": "Últimos 12 meses",
  "all": "Todo o histórico",
};

export function useReportBuilder({
  adminKpis,
  allMetrics,
  allComparativo,
  teams,
}: {
  adminKpis:       AdminKpis["global"];
  allMetrics:      SprintMetrics[];
  allComparativo:  TeamComparativo[];
  teams:           { id: string; name: string; module: string }[];
}) {
  const buildPayload = useMemo(() => (config: ReportConfig): ReportPayload => {
    const filteredMetrics = config.teamId === "all"
      ? allMetrics
      : allMetrics.filter(m => m.teamId === config.teamId);

    const filteredComparativo = config.teamId === "all"
      ? allComparativo
      : allComparativo.filter(t => t.teamId === config.teamId);

    return {
      config,
      kpis:        config.includeKpis ? adminKpis : null,
      sprints:     config.includeSprints ? filteredMetrics : [],
      comparativo: config.includeComparativo ? filteredComparativo : [],
    };
  }, [adminKpis, allMetrics, allComparativo]);

  const defaultConfig = (teamId: string): ReportConfig => ({
    teamId,
    teamLabel:          teamId === "all" ? "Todos os times" : (teams.find(t => t.id === teamId)?.name ?? teamId),
    periodo:            "6m",
    periodoLabel:       PERIODO_LABELS["6m"],
    includeKpis:        true,
    includeSprints:     true,
    includeComparativo: true,
    includeImpedimentos:false,
  });

  return { buildPayload, defaultConfig, PERIODO_LABELS };
}
