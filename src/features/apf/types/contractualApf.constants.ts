export const CORRECTION_REASONS = [
  { value: "wrong_functional_type", label: "Tipo funcional incorreto" },
  { value: "wrong_impact_factor", label: "Fator de impacto incorreto" },
  { value: "wrong_baseline_match", label: "Correspondência incorreta com a baseline" },
  { value: "wrong_pf_value", label: "Valor de PF incorreto" },
  { value: "missing_function", label: "Função não identificada" },
  { value: "extra_function", label: "Função extra / fragmentação excessiva" },
  { value: "other", label: "Outro motivo" },
] as const;

export type CorrectionReason = typeof CORRECTION_REASONS[number]["value"];
