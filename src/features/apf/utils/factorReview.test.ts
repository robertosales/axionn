import { describe, expect, it } from "vitest";
import {
  calculateFactorPreview,
  factorReviewIsValid,
  factorWasOverridden,
} from "./factorReview";

describe("factorReview", () => {
  it("calcula a prévia de PF apenas com processos selecionados", () => {
    const preview = calculateFactorPreview(
      [
        { send: true, functionSigla: "TRN" },
        { send: false, functionSigla: "TRN" },
      ],
      { TRN: 4.6 },
      60,
    );

    expect(preview.selectedProcesses).toBe(1);
    expect(preview.pfBruto).toBeCloseTo(4.6);
    expect(preview.pfFs).toBeCloseTo(2.76);
  });

  it("exige motivo quando o fator confirmado diverge do sugerido", () => {
    expect(factorWasOverridden("A", "I")).toBe(true);
    expect(factorReviewIsValid({
      suggestedFactor: "A",
      confirmedFactor: "I",
      overrideReason: "",
      selectedProcesses: 1,
      hasMissingBaseline: false,
    })).toBe(false);

    expect(factorReviewIsValid({
      suggestedFactor: "A",
      confirmedFactor: "I",
      overrideReason: "regra_contratual",
      selectedProcesses: 1,
      hasMissingBaseline: false,
    })).toBe(true);
  });

  it("bloqueia confirmação sem processo ou com baseline pendente", () => {
    expect(factorReviewIsValid({
      suggestedFactor: "A",
      confirmedFactor: "A",
      overrideReason: "",
      selectedProcesses: 0,
      hasMissingBaseline: false,
    })).toBe(false);

    expect(factorReviewIsValid({
      suggestedFactor: "A",
      confirmedFactor: "A",
      overrideReason: "",
      selectedProcesses: 1,
      hasMissingBaseline: true,
    })).toBe(false);
  });
});
