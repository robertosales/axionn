import type {
  OkrDashboardCycleSummary,
  OkrDashboardTeamSummary,
} from "../types/dashboard";

export interface OkrDashboardComparison {
  progressDelta: number | null;
  atRiskDelta: number;
  staleDelta: number;
}

export function compareOkrCycles(
  primary: OkrDashboardCycleSummary | undefined,
  comparison: OkrDashboardCycleSummary | undefined,
): OkrDashboardComparison | null {
  if (!primary || !comparison) return null;

  return {
    progressDelta:
      primary.average_progress == null || comparison.average_progress == null
        ? null
        : Number((primary.average_progress - comparison.average_progress).toFixed(1)),
    atRiskDelta: primary.at_risk - comparison.at_risk,
    staleDelta: primary.stale_key_results - comparison.stale_key_results,
  };
}

export function teamsForCycle(
  teams: OkrDashboardTeamSummary[],
  cycleId: string | null,
): OkrDashboardTeamSummary[] {
  if (!cycleId) return [];
  return teams
    .filter((team) => team.cycle_id === cycleId)
    .sort((a, b) => (b.average_progress ?? -1) - (a.average_progress ?? -1));
}

export function formatOkrPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "Sem dados";
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

export function healthLabel(health: string): string {
  const labels: Record<string, string> = {
    on_track: "No caminho",
    attention: "Atenção",
    at_risk: "Em risco",
    off_track: "Fora do caminho",
    no_data: "Sem dados",
    completed: "Concluído",
  };
  return labels[health] ?? health;
}
