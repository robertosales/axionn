import type { OkrDirection } from "./okrCalculations";

export interface OkrMetricDefinition {
  code: string;
  name: string;
  description: string;
  unit: string;
  direction: OkrDirection;
  source: string;
  aggregation: "sum" | "average" | "percentage";
  formulaVersion: string;
  formula: string;
}

export const OKR_METRIC_CATALOG: readonly OkrMetricDefinition[] = [
  { code: "velocity", name: "Velocity", description: "Pontos concluídos no período.", unit: "pts", direction: "increase", source: "user_stories", aggregation: "sum", formulaVersion: "1.0", formula: "Soma dos story points concluídos" },
  { code: "sprint_commitment", name: "Commitment", description: "Percentual de HUs planejadas que foram concluídas.", unit: "%", direction: "increase", source: "sprints + user_stories", aggregation: "percentage", formulaVersion: "1.0", formula: "HUs concluídas / HUs planejadas × 100" },
  { code: "throughput", name: "Throughput", description: "Quantidade de HUs concluídas no período.", unit: "un", direction: "increase", source: "user_stories", aggregation: "sum", formulaVersion: "1.0", formula: "Contagem de HUs concluídas" },
  { code: "impediments_open", name: "Impedimentos abertos", description: "Impedimentos ainda não resolvidos.", unit: "un", direction: "decrease", source: "impediments", aggregation: "sum", formulaVersion: "1.0", formula: "Contagem onde resolved_at é nulo" },
] as const;

export function getOkrMetric(code: string | null | undefined) {
  return OKR_METRIC_CATALOG.find((metric) => metric.code === code) ?? null;
}
