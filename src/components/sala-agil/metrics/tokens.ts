// ─── Design tokens compartilhados — Métricas Sala Ágil ──────────────────────
// Importar em MetricCard, FiltersBar, ProductivityChart, AnalyticsSidebar etc.

export const METRIC_ACCENT = {
  green:   { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-200", hex: "#22c55e" },
  blue:    { bg: "bg-blue-500/10",    text: "text-blue-600",    border: "border-blue-200",    hex: "#3b82f6" },
  amber:   { bg: "bg-amber-500/10",   text: "text-amber-600",   border: "border-amber-200",   hex: "#f59e0b" },
  red:     { bg: "bg-red-500/10",     text: "text-red-600",     border: "border-red-200",     hex: "#ef4444" },
  violet:  { bg: "bg-violet-500/10",  text: "text-violet-600",  border: "border-violet-200",  hex: "#8b5cf6" },
  neutral: { bg: "bg-slate-500/10",   text: "text-slate-600",   border: "border-slate-200",   hex: "#64748b" },
} as const;

export type MetricAccent = keyof typeof METRIC_ACCENT;

export const CHART_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
  "#e11d48",
];

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    fontSize: "12px",
    padding: "8px 12px",
  },
  cursor: { fill: "hsl(var(--muted))" },
};

export const CHART_LEGEND_STYLE = {
  wrapperStyle: { fontSize: "11px", paddingTop: "8px" },
};

export const ACTIVITY_TYPE_BORDER: Record<string, string> = {
  feature:     "border-l-blue-500",
  bug:         "border-l-red-500",
  chore:       "border-l-slate-400",
  improvement: "border-l-amber-500",
  task:        "border-l-violet-500",
};

export const ACTIVITY_TYPE_COLOR: Record<string, string> = {
  feature:     "#3b82f6",
  bug:         "#ef4444",
  chore:       "#94a3b8",
  improvement: "#f59e0b",
  task:        "#8b5cf6",
};

export const STATUS_COLORS: Record<string, string> = {
  "Concluída":     "#22c55e",
  "Em Progresso":  "#3b82f6",
  "Não Iniciada":  "#94a3b8",
  "Bloqueada":     "#ef4444",
  "Impedida":      "#eab308",
};
