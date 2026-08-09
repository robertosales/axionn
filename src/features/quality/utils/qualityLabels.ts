const LABELS: Record<string, string> = {
  draft: "Rascunho",
  ready: "Pronto",
  approved: "Aprovado",
  deprecated: "Obsoleto",
  archived: "Arquivado",
  planned: "Planejada",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
  not_run: "Não executado",
  passed: "Aprovado",
  failed: "Falhou",
  blocked: "Bloqueado",
  skipped: "Ignorado",
  invalid: "Inválido",
  retest: "Retestar",
  open: "Aberto",
  triaged: "Triado",
  resolved: "Resolvido",
  closed: "Fechado",
  rejected: "Rejeitado",
  functional: "Funcional",
  regression: "Regressão",
  integration: "Integração",
  api: "API",
  security: "Segurança",
  accessibility: "Acessibilidade",
  compatibility: "Compatibilidade",
  usability: "Usabilidade",
  performance: "Desempenho",
  uat: "Aceite (UAT)",
  other: "Outro",
  manual: "Manual",
  automated: "Automatizado",
  hybrid: "Híbrido",
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export function qualityLabel(value: string | null | undefined): string {
  if (!value) return "Não informado";
  return LABELS[value] ?? value.split("_").join(" ");
}

export function qualityStatusTone(value: string): "default" | "secondary" | "destructive" | "outline" {
  if (["failed", "critical", "cancelled", "blocked", "open"].includes(value)) return "destructive";
  if (["passed", "approved", "completed", "ready", "resolved", "closed"].includes(value)) return "default";
  if (["in_progress", "planned", "retest", "triaged"].includes(value)) return "secondary";
  return "outline";
}
