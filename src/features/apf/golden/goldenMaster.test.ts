import { describe, expect, it } from "vitest";
import { calculateFactorPreview } from "../utils/factorReview";
import { calculatePfFs } from "../utils/contractualApf.helpers";
import { PROCESS_ANALYSIS_PROMPT_VERSION } from "../services/projectBaselineCounting.service";
import { CONTRACTUAL_CURRENT_GOLDEN, LEGACY_V1_GOLDEN } from "./goldenMaster.fixtures";

describe("APF Golden Master — Legacy v1", () => {
  it("recalcula o total com os pesos fixos atuais e ignora o total proposto pela IA", () => {
    const { frozenAiProposal: proposal, expected } = LEGACY_V1_GOLDEN;
    const total = proposal.EI * expected.weights.EI
      + proposal.EO * expected.weights.EO
      + proposal.EQ * expected.weights.EQ
      + proposal.ILF * expected.weights.ILF
      + proposal.EIF * expected.weights.EIF;

    expect(total).toBe(expected.total);
    expect(total).not.toBe(proposal.total);
    expect(expected.sideEffects).toContain("function_point_analyses upserted");
  });
});

describe("APF Golden Master — contractual current", () => {
  it("congela proposta, pesos, fator, arredondamento e efeitos atuais", () => {
    const fixture = CONTRACTUAL_CURRENT_GOLDEN;
    expect(fixture.frozenAiProposal.promptVersion).toBe(PROCESS_ANALYSIS_PROMPT_VERSION);

    const preview = calculateFactorPreview(
      fixture.frozenAiProposal.processes.map(() => ({ send: true, functionSigla: "TRN" })),
      { TRN: 4.6 },
      60,
    );
    expect(String(preview.pfBruto)).toBe(fixture.expected.totalPfBruto);
    expect(String(preview.pfFs)).toBe(fixture.expected.totalPfAdjusted);
    expect(String(calculatePfFs(4.6, 60))).toBe(fixture.expected.items[0].pfAdjusted);
    expect(fixture.expected.pfFaturavel).toBeNull();
    expect(fixture.expected.sideEffects).toContain("apf_counting_items materialized");
  });

  it("não usa os campos financeiros não confiáveis da proposta congelada", () => {
    const untrusted = CONTRACTUAL_CURRENT_GOLDEN.frozenAiProposal.untrustedFinancialFields;
    expect(untrusted.total).not.toBe(CONTRACTUAL_CURRENT_GOLDEN.expected.totalPfAdjusted);
    expect(untrusted.weight).not.toBe(CONTRACTUAL_CURRENT_GOLDEN.expected.items[0].weight);
  });
});
