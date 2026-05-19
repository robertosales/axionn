import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// ── Row types ────────────────────────────────────────────────────────────────
export type Rdm                  = Tables<"rdms">;
export type RdmSprintItem        = Tables<"rdm_sprint_items">;
export type RdmParticipante      = Tables<"rdm_participantes">;
export type RdmChecklistTemplate = Tables<"rdm_checklist_templates">;
export type RdmChecklistItem     = Tables<"rdm_checklist_items">;
export type RdmGoNogo            = Tables<"rdm_gonogo">;
export type RdmAuditLog          = Tables<"rdm_audit_log">;

// ── Novas tabelas (rdm_sprints / rdm_sprint_redmines) ────────────────────────
export interface RdmSprint {
  id:         string;
  rdm_id:     string;
  sprint_id:  string | null;
  nome:       string;
  created_at: string;
  updated_at: string;
  redmines?:  RdmSprintRedmine[];
}

export interface RdmSprintRedmine {
  id:             string;
  rdm_sprint_id:  string;
  numero:         string;
  descricao:      string | null;
  created_at:     string;
  updated_at:     string;
}

export type RdmSprintInsert    = Omit<RdmSprint,    "id" | "created_at" | "updated_at" | "redmines">;
export type RdmSprintUpdate    = Partial<Pick<RdmSprint,    "nome" | "sprint_id">>;
export type RdmSprintRedmineInsert = Omit<RdmSprintRedmine, "id" | "created_at" | "updated_at">;
export type RdmSprintRedmineUpdate = Partial<Pick<RdmSprintRedmine, "numero" | "descricao">>;

// ── Insert types ─────────────────────────────────────────────────────────────
export type RdmInsert                  = TablesInsert<"rdms">;
export type RdmSprintItemInsert        = TablesInsert<"rdm_sprint_items">;
export type RdmParticipanteInsert      = TablesInsert<"rdm_participantes">;
export type RdmChecklistItemInsert     = TablesInsert<"rdm_checklist_items">;
export type RdmGoNogoInsert            = TablesInsert<"rdm_gonogo">;

// ── Update types ─────────────────────────────────────────────────────────────
export type RdmUpdate              = TablesUpdate<"rdms">;
export type RdmChecklistItemUpdate = TablesUpdate<"rdm_checklist_items">;

// ── STATUS ───────────────────────────────────────────────────────────────────
export const RDM_STATUS = [
  "rascunho",
  "em_aprovacao",
  "aprovada",
  "em_execucao",
  "implantada",
  "rollback_executado",
  "cancelada",
] as const;
export type RdmStatus = (typeof RDM_STATUS)[number];

export const RDM_STATUS_LABELS: Record<RdmStatus, string> = {
  rascunho:           "Rascunho",
  em_aprovacao:       "Em Aprovação",
  aprovada:           "Aprovada",
  em_execucao:        "Em Execução",
  implantada:         "Implantada",
  rollback_executado: "Rollback Executado",
  cancelada:          "Cancelada",
};

export const RDM_STATUS_COLORS: Record<RdmStatus, string> = {
  rascunho:           "bg-slate-500/15 text-slate-400 border-slate-500/20",
  em_aprovacao:       "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  aprovada:           "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  em_execucao:        "bg-blue-500/15 text-blue-400 border-blue-500/20",
  implantada:         "bg-green-500/15 text-green-400 border-green-500/20",
  rollback_executado: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  cancelada:          "bg-red-500/15 text-red-400 border-red-500/20",
};

// ── TIPO DE MUDANÇA ──────────────────────────────────────────────────────────
export const RDM_TIPO_MUDANCA = ["evolutiva", "corretiva", "emergencial"] as const;
export type RdmTipoMudanca = (typeof RDM_TIPO_MUDANCA)[number];

export const RDM_TIPO_LABELS: Record<RdmTipoMudanca, string> = {
  evolutiva:   "Evolutiva",
  corretiva:   "Corretiva",
  emergencial: "Emergencial",
};

// ── RISCO ────────────────────────────────────────────────────────────────────
export const RDM_RISCO = ["baixo", "medio", "alto"] as const;
export type RdmRisco = (typeof RDM_RISCO)[number];

export const RDM_RISCO_LABELS: Record<RdmRisco, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto:  "Alto",
};

export const RDM_RISCO_COLORS: Record<RdmRisco, string> = {
  baixo: "bg-green-500/15 text-green-400 border-green-500/20",
  medio: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  alto:  "bg-red-500/15 text-red-400 border-red-500/20",
};

// ── AMBIENTE ─────────────────────────────────────────────────────────────────
export const RDM_AMBIENTE = ["producao", "homologacao", "desenvolvimento"] as const;
export type RdmAmbiente = (typeof RDM_AMBIENTE)[number];

export const RDM_AMBIENTE_LABELS: Record<RdmAmbiente, string> = {
  producao:        "Produção",
  homologacao:     "Homologação",
  desenvolvimento: "Desenvolvimento",
};

// ── GO/NO-GO ─────────────────────────────────────────────────────────────────
export const RDM_GONOGO_PAPEL = [
  "gestor_ti", "gestor_negocio", "arquiteto", "qa_lead", "scrum_master",
] as const;
export type RdmGoNogoPapel = (typeof RDM_GONOGO_PAPEL)[number];

export const RDM_GONOGO_PAPEL_LABELS: Record<RdmGoNogoPapel, string> = {
  gestor_ti:      "Gestor TI",
  gestor_negocio: "Gestor Negócio",
  arquiteto:      "Arquiteto",
  qa_lead:        "QA Lead",
  scrum_master:   "Scrum Master",
};

// ── CHECKLIST STATUS ─────────────────────────────────────────────────────────
export const RDM_CHECKLIST_STATUS = ["pendente", "em_andamento", "concluido", "nao_aplicavel"] as const;
export type RdmChecklistStatus = (typeof RDM_CHECKLIST_STATUS)[number];

export const RDM_CHECKLIST_STATUS_LABELS: Record<RdmChecklistStatus, string> = {
  pendente:      "Pendente",
  em_andamento:  "Em Andamento",
  concluido:     "Concluído",
  nao_aplicavel: "N/A",
};

// ── Tipo enriquecido ─────────────────────────────────────────────────────────
export interface RdmComParticipantes extends Rdm {
  participantes?: (RdmParticipante & { profile?: { display_name: string; email: string } | null })[];
  gonogo?:        RdmGoNogo[];
  checklist?:     RdmChecklistItem[];
}
