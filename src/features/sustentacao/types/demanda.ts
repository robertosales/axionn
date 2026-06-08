export type DemandaTipo = "corretiva" | "evolutiva" | "manutencao_corretiva";
export type DemandaSLA = "24x7" | "padrao" | "continuo";

export const FLOW_PRINCIPAL = [
  "fila_atendimento",
  "planejamento_elaboracao",
  "planejamento_ag_aprovacao",
  "planejamento_aprovada",
  "em_execucao",
  "hom_ag_homologacao",
  "hom_homologada",
  "fila_producao",
  "ag_aceite_final",
  "fila_concluida",
] as const;

export const ALL_SITUACOES = [
  "fila_atendimento",
  "planejamento_elaboracao",
  "planejamento_ag_aprovacao",
  "planejamento_aprovada",
  "em_execucao",
  "bloqueada",
  "hom_ag_homologacao",
  "hom_homologada",
  "rejeitada",
  "fila_producao",
  "ag_aceite_final",
  "cancelada",
  "fila_concluida",
] as const;

export type DemandaSituacao = (typeof ALL_SITUACOES)[number];

export const SITUACAO_LABELS: Record<string, string> = {
  fila_atendimento: "Fila de Atendimento",
  planejamento_elaboracao: "Planejamento: Em Elaboração",
  planejamento_ag_aprovacao: "Planejamento: Ag. Aprovação",
  planejamento_aprovada: "Planejamento: Aprovada p/ Exec",
  em_execucao: "Em Execução",
  bloqueada: "Bloqueada",
  hom_ag_homologacao: "Hom: Ag. Homologação",
  hom_homologada: "Hom: Homologada",
  rejeitada: "Rejeitada",
  fila_producao: "Fila para Produção (Infra)",
  ag_aceite_final: "Ag. Aceite Final",
  cancelada: "Cancelada",
  fila_concluida: "Concluída",
};

export const SITUACAO_COLORS: Record<string, string> = {
  fila_atendimento: "bg-slate-100 text-slate-700 border-slate-300",
  planejamento_elaboracao: "bg-blue-100 text-blue-700 border-blue-300",
  planejamento_ag_aprovacao: "bg-indigo-100 text-indigo-700 border-indigo-300",
  planejamento_aprovada: "bg-violet-100 text-violet-700 border-violet-300",
  em_execucao: "bg-amber-100 text-amber-700 border-amber-300",
  bloqueada: "bg-red-100 text-red-700 border-red-300",
  hom_ag_homologacao: "bg-cyan-100 text-cyan-700 border-cyan-300",
  hom_homologada: "bg-teal-100 text-teal-700 border-teal-300",
  rejeitada: "bg-rose-100 text-rose-800 border-rose-300",
  fila_producao: "bg-orange-100 text-orange-700 border-orange-300",
  ag_aceite_final: "bg-emerald-100 text-emerald-700 border-emerald-300",
  cancelada: "bg-gray-200 text-gray-700 border-gray-300",
  fila_concluida: "bg-green-100 text-green-700 border-green-300",
};

export const FASES = [
  "analise",
  "planejamento",
  "execucao",
  "homologacao",
  "producao",
  "reuniao_cliente",
  "reuniao_interna",
] as const;

export type DemandaFase = (typeof FASES)[number];

export const FASE_LABELS: Record<string, string> = {
  analise: "Análise",
  planejamento: "Planejamento",
  execucao: "Execução",
  homologacao: "Homologação",
  producao: "Produção",
  reuniao_cliente: "Reunião com o Cliente",
  reuniao_interna: "Reunião Interna",
};

export const REQUIRES_JUSTIFICATIVA = ["rejeitada", "cancelada", "planejamento_ag_aprovacao"] as const;
export const TERMINAL_STATUSES = ["ag_aceite_final", "cancelada"] as const;

export interface Demanda {
  id: string;
  team_id: string;
  rhm: string;
  projeto: string;
  titulo?: string | null;
  tipo: DemandaTipo;
  situacao: string;
  descricao: string;
  sla: DemandaSLA;
  /** ID do contrato vinculado ao projeto desta demanda — populado pela RPC */
  contract_id?: string | null;
  /** Prioridade SLA (urgent | high | medium | low) — populado pela RPC */
  sla_priority?: string | null;
  demandante?: string | null;
  data_abertura?: string | null;
  data_previsao_encerramento?: string | null;
  responsavel_requisitos?: string | null;
  responsavel_dev?: string | null;
  responsavel_teste?: string | null;
  responsavel_arquiteto?: string | null;
  aceite_data?: string | null;
  aceite_responsavel?: string | null;
  created_at: string;
  updated_at: string;
  situacao_changed_at?: string | null;
  total_horas?: number | null;
}

export interface DemandaTransition {
  id: string;
  demanda_id: string;
  from_status: string | null;
  to_status: string;
  user_id: string;
  justificativa: string | null;
  created_at: string;
}

export interface DemandaHour {
  id: string;
  demanda_id: string;
  user_id: string;
  horas: number;
  fase: string;
  descricao: string;
  created_at: string;
}

export function isDemandaIniciada(demanda: Demanda): boolean {
  return demanda.situacao !== "fila_atendimento";
}

export function isDemandaConcluida(demanda: Demanda): boolean {
  return demanda.situacao === "fila_concluida";
}

export function getResponsavelAtivo(demanda: Demanda): string | null {
  const s = demanda.situacao;

  const porFase = [
    "fila_atendimento",
    "planejamento_elaboracao",
    "planejamento_ag_aprovacao",
    "planejamento_aprovada",
  ].includes(s)
    ? demanda.responsavel_requisitos
    : ["em_execucao", "bloqueada", "fila_producao"].includes(s)
      ? demanda.responsavel_dev
      : ["hom_ag_homologacao", "hom_homologada"].includes(s)
        ? demanda.responsavel_arquiteto
        : ["fila_concluida"].includes(s)
          ? demanda.responsavel_dev
          : null;

  if (porFase) return porFase;

  return (
    demanda.responsavel_dev ??
    demanda.responsavel_requisitos ??
    demanda.responsavel_teste ??
    demanda.responsavel_arquiteto ??
    null
  );
}

export function getFaseLabel(fase: string): string {
  return FASE_LABELS[fase] ?? fase;
}

/** @deprecated Use FLOW_PRINCIPAL */
export const SITUACOES_CORRETIVA = ALL_SITUACOES;
/** @deprecated Use FLOW_PRINCIPAL */
export const SITUACOES_EVOLUTIVA_PREFIX: readonly string[] = [];
