export const LEGACY_V1_GOLDEN = {
  id: "legacy-v1-basic-ifpug",
  runtime: "count-function-points",
  input: {
    project_id: "00000000-0000-4000-8000-000000000101",
    story_id: "00000000-0000-4000-8000-000000000102",
    story_text: "Cadastrar solicitação, emitir comprovante, consultar situação e manter solicitações.",
  },
  frozenAiProposal: {
    EI: 2,
    EO: 1,
    EQ: 0,
    ILF: 1,
    EIF: 0,
    total: 999,
    confidence: 0.86,
    reasoning: "Proposta congelada; nenhuma chamada de IA é realizada pelo teste.",
  },
  expected: {
    weights: { EI: 3, EO: 4, EQ: 3, ILF: 7, EIF: 5 },
    breakdown: { EI: 2, EO: 1, EQ: 0, ILF: 1, EIF: 0 },
    total: 17,
    complexity: "media",
    state: "persisted_unvalidated",
    sideEffects: [
      "user_stories.function_points updated",
      "function_point_analyses upserted",
    ],
  },
} as const;

export const CONTRACTUAL_CURRENT_GOLDEN = {
  id: "contractual-current-two-trn-factor-a",
  runtime: "useContractualApfCounting",
  input: {
    story_id: "00000000-0000-4000-8000-000000000201",
    session_id: "00000000-0000-4000-8000-000000000202",
    factor: { sigla: "A", contribution_pct: "60" },
    functionTypes: { TRN: { complexity: "Padrão", weight: "4.6" } },
  },
  frozenAiProposal: {
    promptVersion: "apf-process-separation-v1",
    processes: [
      { clientKey: "P1", name: "Cadastrar solicitação", suggestedFunctionType: "TRN" },
      { clientKey: "P2", name: "Confirmar solicitação", suggestedFunctionType: "TRN" },
    ],
    untrustedFinancialFields: { weight: "999", percentage: "100", total: "999" },
  },
  expected: {
    items: [
      { clientKey: "P1", type: "TRN", complexity: "Padrão", det: null, ftr: null, ret: null, weight: "4.6", factor: "A", percentage: "60", pfBruto: "4.6", pfAdjusted: "2.76" },
      { clientKey: "P2", type: "TRN", complexity: "Padrão", det: null, ftr: null, ret: null, weight: "4.6", factor: "A", percentage: "60", pfBruto: "4.6", pfAdjusted: "2.76" },
    ],
    totalPfBruto: "9.2",
    totalPfAdjusted: "5.52",
    pfFaturavel: null,
    state: "materialized_pending_validation",
    sideEffects: [
      "apf_counting_items materialized",
      "apf_counting_sessions totals updated",
      "user_stories APF totals updated",
      "apf_validation_events appended",
    ],
  },
} as const;
