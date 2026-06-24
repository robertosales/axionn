export interface ContractualItem {
  id: string;
  baseline_item_id: string | null;
  story_id?: string | null;
  story_ids?: string[];
  hu_ref: string;
  ef_description: string;
  function_sigla: string;
  factor_sigla: string;
  pf_bruto: number;
  contribution_pct: number;
  pf_fs: number;
  match_type?: string | null;
  match_confidence?: number | null;
  confidence?: number | null;
  justification?: string | null;
  evidence_literal?: string | null;
  is_validated?: boolean;
  corrected_function_sigla?: string | null;
  corrected_factor_sigla?: string | null;
  corrected_pf_bruto?: number | null;
  corrected_pf_fs?: number | null;
}

export interface HuRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  acceptance_criteria: string | null;
  story_points: number | null;
  function_points: number | null;
  apf_pf_bruto?: number | null;
  apf_pf_fs?: number | null;
  ai_fp_confidence: number | null;
  ai_fp_validated: boolean;
  _items: ContractualItem[];
  _loading?: boolean;
  _error?: string | null;
  _providerUsed?: string | null;
  _sessionId?: string | null;
}
