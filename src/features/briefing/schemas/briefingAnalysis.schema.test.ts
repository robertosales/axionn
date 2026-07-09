import { describe, expect, it } from "vitest";

import { briefingAnalysisSchema } from "./briefingAnalysis.schema";

const validAnalysis = {
  schemaVersion: "1.0",
  language: "pt-BR",
  summary: "A equipe confirmou a entrega e definiu a validacao.",
  suggestions: [
    {
      type: "action",
      title: "Validar o ambiente de homologacao",
      description: "Carlos fara a validacao antes da entrega.",
      assigneeName: "Carlos",
      dueDate: "2026-07-10",
      dateSource: "explicit",
      priority: "high",
      evidence: [
        {
          quote: "Carlos valida o ambiente amanha.",
          speaker: "Ana",
          sourceStart: 120,
          sourceEnd: 153,
        },
      ],
    },
  ],
};

describe("briefingAnalysisSchema", () => {
  it("aceita uma analise estruturada com evidencia", () => {
    expect(briefingAnalysisSchema.parse(validAnalysis)).toEqual(validAnalysis);
  });

  it("rejeita sugestao sem evidencia", () => {
    const result = briefingAnalysisSchema.safeParse({
      ...validAnalysis,
      suggestions: [{ ...validAnalysis.suggestions[0], evidence: [] }],
    });

    expect(result.success).toBe(false);
  });

  it("rejeita data marcada como ausente quando dueDate foi preenchida", () => {
    const result = briefingAnalysisSchema.safeParse({
      ...validAnalysis,
      suggestions: [
        { ...validAnalysis.suggestions[0], dateSource: "absent" },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejeita intervalo de evidencia invertido", () => {
    const result = briefingAnalysisSchema.safeParse({
      ...validAnalysis,
      suggestions: [
        {
          ...validAnalysis.suggestions[0],
          evidence: [
            {
              quote: "Trecho",
              sourceStart: 20,
              sourceEnd: 10,
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
