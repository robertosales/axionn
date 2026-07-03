import type { ContractualItem, HuRow } from "./apfItem.types";
import type { CorrectionReason } from "./contractualApf.constants";
import type { ElementaryProcessRole } from "../utils/elementaryProcess";

export interface BaselineCandidate {
  id: string;
  item_ref: string;
  process_ref?: string | null;
  process_name?: string | null;
  description: string;
  module: string | null;
  function_sigla: string;
  factor_sigla: string;
  category_sigla: string | null;
  complexity: string;
  pf_bruto: number;
  contribution_pct: number;
  pf_fs: number;
  is_measurable: boolean;
  notes: string | null;
  match_score: number;
}

export interface ProjectBaselineProcessItem {
  id: string;
  item_ref: string;
  process_ref: string;
  process_name: string;
  description: string;
  module: string | null;
  function_sigla: string;
  baseline_factor_sigla: string;
  category_sigla: string | null;
  complexity: string;
  pf_bruto: number;
  pf_fs_baseline: number;
  is_measurable: boolean;
  notes: string | null;
  product_reference: string | null;
  project_reference: string | null;
  measurement_reference: string | null;
  match_score?: number;
}

export interface ProjectBaselineProcessCandidate {
  baseline_id: string;
  process_ref: string;
  process_name: string;
  item_count: number;
  total_pf_bruto: number;
  items: ProjectBaselineProcessItem[];
  match_score: number;
}

export interface LogicalFileCandidate {
  id: string;
  item_ref: string;
  description: string;
  function_sigla: "ALI" | "AIE";
  match_score?: number;
}

export interface ValidationPrecedentCandidate {
  hu_title: string | null;
  validated_functional_type: string | null;
  validated_factor_sigla: string | null;
  correction_notes: string | null;
  ai_reasoning: string | null;
  baseline_item_id: string | null;
}

export interface PersistSummary {
  session_id: string;
  story_pf_bruto: number;
  story_pf_fs: number;
  items: ContractualItem[];
  inserted_items: number;
  deduplicated_items: number;
  absorbed_items?: number;
  review_required_items?: number;
}

export interface GenerateResponse {
  success?: boolean;
  markdown?: string;
  providerUsed?: string;
  userMessage?: string;
  rawError?: string;
}

export type AnalysisStatus = "ok" | "requer_validacao_humana";
export type AnalysisCandidateType = "EE" | "CE" | "SE" | "TRN" | "indefinido";
export type AnalysisRecommendation = "enviar" | "nao_enviar" | "enviar_com_validacao";

export type FactorOverrideReason =
  | "correcao_classificacao"
  | "precedente_oficial"
  | "regra_contratual"
  | "evidencia_funcional"
  | "outro";

export interface FactorReviewInput {
  factor_sigla: string;
  factor_override_reason: FactorOverrideReason | "";
  factor_override_notes: string;
}

export interface AnalysisBaselineAnalog {
  id?: string;
  baseline_item_id: string | null;
  item_baseline: string;
  tipo: AnalysisCandidateType | "ALI" | "AIE";
  aderencia: "alta" | "media" | "baixa";
  motivo_aderencia: string;
  principal?: boolean;
}

export interface AnalysisLogicalFile {
  id?: string;
  baseline_item_id: string | null;
  nome: string;
  tipo: "ALI" | "AIE" | "desconhecido";
  papel_no_processo: "mantido" | "consultado" | "ambos" | "desconhecido";
}

export interface AnalysisProcess {
  id: string;
  id_temporario: string;
  nome_processo: string;
  acao_negocio: string;
  objeto_negocio: string;
  tipo_funcional_candidato: AnalysisCandidateType;
  deve_contar_como_processo_elementar: boolean;
  selected_by_default: boolean;
  decision_source: string;
  justificativa_separacao: string;
  resultado_funcional_entregue: string;
  central: boolean;
  completo: boolean;
  independente_dos_demais: boolean;
  precedente_baseline_encontrado: boolean;
  recomendacao_para_contador_existente: AnalysisRecommendation;
  requer_validacao_humana: boolean;
  confianca: number;
  duvidas_ou_riscos: string[];
  sinais_para_o_contador_existente: {
    campos_percebidos: string[];
    arquivos_referenciados_percebidos: string[];
    observacoes: string;
  };
  selected_baseline_item_id: string | null;
  baseline_analogas: AnalysisBaselineAnalog[];
  arquivos_logicos_referenciados: AnalysisLogicalFile[];
}

export interface ApfProcessAnalysis {
  id: string;
  project_id: string;
  story_id: string;
  baseline_id: string;
  status: "processing" | "ok" | "review_required" | "counted" | "error" | "superseded";
  status_reason: string | null;
  validation_mode: "assisted" | "automatic";
  inferred_factor_sigla: string;
  suggested_factor_sigla: string | null;
  factor_source: string;
  factor_confidence: number | null;
  factor_review_required: boolean;
  factor_reasoning: string | null;
  confirmed_factor_sigla: string | null;
  confirmed_factor_source: string | null;
  factor_override_reason: FactorOverrideReason | null;
  factor_override_notes: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  hu_summary: string | null;
  processo_central: { nome: string | null; justificativa: string | null };
  quantidade_processos_identificados: number;
  quantidade_processos_contaveis: number;
  quantidade_processos_em_revisao: number;
  processos: AnalysisProcess[];
  itens_absorvidos_no_processo_central: Array<{
    descricao: string;
    motivo_absorcao: string;
  }>;
  itens_nao_contaveis_como_processo: Array<{
    descricao: string;
    motivo: string;
  }>;
  pendencias_de_detalhamento: string[];
  prompt_version: string;
  schema_version: string;
  provider_name: string | null;
  model_name: string | null;
  created_at: string;
  finished_at: string | null;
  materialized_at: string | null;
}

export interface AnalysisReviewDecision {
  process_id: string;
  send: boolean;
  baseline_item_id: string | null;
}

export interface ValidationItemState extends ContractualItem {
  selectedFunction: string;
  selectedFactor: string;
  selectedProcessRole: ElementaryProcessRole;
  selectedProcessComplete: boolean;
  selectedProcessIndependent: boolean;
  selectedProcessPrecedent: string;
}

export interface ValidationDialogState {
  open: boolean;
  hu: HuRow | null;
  items: ValidationItemState[];
  correctionReason: CorrectionReason | "";
  correctionNotes: string;
}
