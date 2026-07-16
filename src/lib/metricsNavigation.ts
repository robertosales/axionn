export const METRICS_TABS = ["individual", "team", "quality", "impediments"] as const;
export type MetricsTab = (typeof METRICS_TABS)[number];

export function normalizeMetricsTab(value: string | null | undefined): MetricsTab {
  return METRICS_TABS.includes(value as MetricsTab) ? value as MetricsTab : "individual";
}

export function legacyMetricsDestination(value: string | null | undefined): string | null {
  const normalized = value?.toLocaleLowerCase("pt-BR");
  if (normalized === "reports" || normalized === "relatorios") return "/sala-agil/relatorios";
  if (normalized === "release" || normalized === "releases") return "/sala-agil/releases";
  return null;
}
