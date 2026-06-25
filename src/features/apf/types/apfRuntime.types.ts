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
