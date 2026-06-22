// ============================================================
// TIPOS TypeScript — Multi-Tenancy + APF Engine
// Branch: feat/multi-tenancy-apf-engine
// Compatível com padrão existente: src/features/admin/hooks/useContracts.ts
// ============================================================

// ── MULTI-TENANCY ────────────────────────────────────────────────────────────

export type OrgPlan   = 'free' | 'pro' | 'enterprise';
export type OrgStatus = 'active' | 'trial' | 'suspended' | 'cancelled';
export type OrgMemberRole = 'owner' | 'admin' | 'member';

export interface Organization {
  id:                      string;
  name:                    string;
  slug:                    string;
  plan:                    OrgPlan;
  status:                  OrgStatus;
  logo_url?:               string | null;
  max_projects:            number;
  max_users:               number;
  max_countings_per_month: number;
  contact_email?:          string | null;
  contact_name?:           string | null;
  trial_ends_at?:          string | null;
  created_at:              string;
  updated_at:              string;
  // campos computados (JOINs)
  memberCount?:            number;
  projectCount?:           number;
  totalPfThisMonth?:       number;
}

export interface OrganizationMember {
  id:         string;
  org_id:     string;
  user_id:    string;
  role:       OrgMemberRole;
  invited_by?: string | null;
  joined_at:  string;
  // JOIN
  user_email?: string;
  user_name?:  string;
}

// ── APF — MODELO ─────────────────────────────────────────────────────────────

export type ApfStandard = 'pfs_dpf' | 'ifpug' | 'custom';
export type ApfFunctionClass = 'transactional' | 'data';

export interface ApfCountingModel {
  id:           string;
  contract_id:  string;
  name:         string;
  description?: string | null;
  standard:     ApfStandard;
  is_active:    boolean;
  created_at:   string;
  updated_at:   string;
  // JOINs
  function_types?:   ApfFunctionType[];
  impact_factors?:   ApfImpactFactor[];
  categories?:       ApfCategory[];
  counting_rules?:   ApfCountingRules;
  output_template?:  ApfOutputTemplate;
}

export interface ApfFunctionType {
  id:          string;
  model_id:    string;
  sigla:       string;        // TRN, ARQ, EI, EO...
  name:        string;
  func_class:  ApfFunctionClass;
  weight:      number;        // 4.60, 7.00
  is_active:   boolean;
  sort_order:  number;
}

export interface ApfImpactFactor {
  id:                 string;
  model_id:           string;
  sigla:              string;  // I, A, A75, COR50, GAR...
  name:               string;
  contribution_pct:   number;  // 100, 60, 75...
  action_on_baseline: string;  // Incluir/Alterar | Remover | Não Impacta
  origin?:            string | null;
  is_inm:             boolean; // Item Não Mensurável
  is_active:          boolean;
  sort_order:         number;
  notes?:             string | null;
}

export interface ApfCategory {
  id:           string;
  model_id:     string;
  sigla:        string;  // ARN, ADS, ATD, AGR, NM
  name:         string;
  description?: string | null;
  is_active:    boolean;
}

export interface ApfCountingRules {
  id:                           string;
  model_id:                     string;
  rule_mission?:                string | null;
  rule_fundamental_principle?:  string | null;
  rule_decision_hierarchy?:     string | null;
  rule_critical_guidelines?:    string | null;
  rule_elementary_process?:     string | null;
  rule_granularity?:            string | null;
  rule_precedence_override?:    string | null;
  rule_contractual_consistency?: string | null;
  rule_closure?:                string | null;
  updated_at:                   string;
}

export interface ApfOutputSection {
  id:          string;
  title:       string;
  type:        'table' | 'text' | 'per_hu_table' | 'multi_table' | 'legend';
  fields?:     { key: string; label: string }[];
  columns?:    string[];
  subtables?:  { id: string; title: string; columns: string[] }[];
  description?: string;
  terms?:      string[];
}

export interface ApfOutputTemplate {
  id:         string;
  model_id:   string;
  name:       string;
  sections:   ApfOutputSection[];
  updated_at: string;
}

// ── APF — BASELINE ────────────────────────────────────────────────────────────

export type ApfBaselineStatus = 'draft' | 'active' | 'archived';

export interface ApfProjectBaseline {
  id:           string;
  project_id:   string;
  model_id:     string;
  version:      string;         // v1.0, Sprint01-R05
  label?:       string | null;
  status:       ApfBaselineStatus;
  imported_at?: string | null;
  imported_by?: string | null;
  created_at:   string;
  updated_at:   string;
  // JOINs
  items?:       ApfBaselineItem[];
  itemCount?:   number;
}

export interface ApfBaselineItem {
  id:              string;
  baseline_id:     string;
  item_ref:        string;   // HU049.1, Processo Bancário
  description:     string;
  module?:         string | null;  // PROC AUTORIZATIVO, PROC BANCÁRIOS
  function_sigla:  string;  // TRN, ARQ
  category_sigla?: string | null;  // ARN, ADS...
  complexity:      string;  // Padrão, Simples, Complexo
  pf_bruto?:       number | null;
  notes?:          string | null;
  sort_order:      number;
}

// ── APF — SESSÃO DE CONTAGEM ──────────────────────────────────────────────────

export type ApfSessionStatus = 'in_progress' | 'pending_review' | 'validated' | 'rejected';

export interface ApfCountingSession {
  id:              string;
  project_id:      string;
  baseline_id?:    string | null;
  model_id:        string;
  sprint_ref?:     string | null;   // Sprint 01
  release_ref?:    string | null;   // Release 05
  redmine_ref?:    string | null;   // #25044
  status:          ApfSessionStatus;
  total_pf_bruto:  number;
  total_pf_fs:     number;
  total_functions: number;
  total_hus:       number;
  analyst_id?:     string | null;
  reviewer_id?:    string | null;
  validated_at?:   string | null;
  evidence_doc?:   string | null;   // markdown gerado
  ai_model_used?:  string | null;
  created_at:      string;
  updated_at:      string;
  // JOINs
  items?:          ApfCountingItem[];
  gray_zones?:     ApfGrayZone[];
}

export interface ApfCountingItem {
  id:                       string;
  session_id:               string;
  baseline_item_id?:        string | null;
  hu_ref?:                  string | null;
  ef_description:           string;
  function_sigla:           string;   // TRN, ARQ
  factor_sigla:             string;   // I, A, A75...
  category_sigla?:          string | null;
  complexity:               string;
  pf_bruto:                 number;
  contribution_pct:         number;   // 100, 60, 75...
  pf_fs:                    number;   // pf_bruto * (contribution_pct / 100)
  justification?:           string | null;
  evidence_literal?:        string | null;
  precedent_ref?:           string | null;
  is_validated:             boolean;
  validated_by?:            string | null;
  validated_at?:            string | null;
  analyst_note?:            string | null;
  // Correção humana (fecha o ciclo de aprendizado)
  corrected_function_sigla?: string | null;
  corrected_factor_sigla?:   string | null;
  corrected_pf_bruto?:       number | null;
  corrected_pf_fs?:          number | null;
  sort_order:               number;
}

export interface ApfGrayZone {
  id:                   string;
  session_id:           string;
  counting_item_id?:    string | null;
  hu_ref?:              string | null;
  scenario:             string;
  interpretation_a:     string;
  interpretation_b:     string;
  pf_difference?:       number | null;
  decision?:            string | null;
  confidence_level?:    string | null;   // alto, médio, baixo
  applicable_precedent?: string | null;
  resolved:             boolean;
  resolved_by?:         string | null;
  resolved_at?:         string | null;
  created_at:           string;
}

// ── HELPERS — cálculo de PF FS ────────────────────────────────────────────────

/**
 * Calcula PF FS dado o PF Bruto e o fator de impacto.
 * PF FS = PF Bruto × (contribution_pct / 100)
 */
export function calcPfFs(pfBruto: number, contributionPct: number): number {
  return Math.round((pfBruto * (contributionPct / 100)) * 100) / 100;
}

/**
 * Resolve o peso de um tipo de função pelo sigla.
 */
export function getFunctionWeight(
  sigla: string,
  functionTypes: ApfFunctionType[]
): number {
  return functionTypes.find(t => t.sigla === sigla)?.weight ?? 0;
}

/**
 * Resolve a contribution_pct de um fator pelo sigla.
 */
export function getFactorContribution(
  sigla: string,
  factors: ApfImpactFactor[]
): number {
  return factors.find(f => f.sigla === sigla)?.contribution_pct ?? 100;
}
