import { describe, expect, it } from "vitest";
import type { ProjectBaselineProcessCandidate } from "../types/apfRuntime.types";
import {
  buildProjectBaselineItems,
  hasDeterministicProcessMatch,
  inferImpactFactor,
  parseProcessSelection,
} from "./projectBaselineCounting.service";

function candidate(
  overrides: Partial<ProjectBaselineProcessCandidate> = {},
): ProjectBaselineProcessCandidate {
  return {
    baseline_id: "baseline-1",
    process_ref: "EF172",
    process_name: "Processo Bancário - Distribuir Processo",
    item_count: 3,
    total_pf_bruto: 10,
    match_score: 0.86,
    items: [
      {
        id: "item-ee",
        item_ref: "EF172:EE:10",
        process_ref: "EF172",
        process_name: "Processo Bancário - Distribuir Processo",
        description: "EF172 - Processo Bancário - Distribuir Processo",
        module: null,
        function_sigla: "EE",
        baseline_factor_sigla: "I",
        category_sigla: null,
        complexity: "Baixa",
        pf_bruto: 3,
        pf_fs_baseline: 3,
        is_measurable: true,
        notes: null,
        product_reference: "GESP3",
        project_reference: "Projeto GESP3",
        measurement_reference: "Baseline inicial",
      },
      {
        id: "item-ce-medium",
        item_ref: "EF172:CE:11",
        process_ref: "EF172",
        process_name: "Processo Bancário - Distribuir Processo",
        description: "EF172 - Processo Bancário - Listar Processos",
        module: null,
        function_sigla: "CE",
        baseline_factor_sigla: "I",
        category_sigla: null,
        complexity: "Média",
        pf_bruto: 4,
        pf_fs_baseline: 4,
        is_measurable: true,
        notes: null,
        product_reference: "GESP3",
        project_reference: "Projeto GESP3",
        measurement_reference: "Baseline inicial",
      },
      {
        id: "item-ce-low",
        item_ref: "EF172:CE:12",
        process_ref: "EF172",
        process_name: "Processo Bancário - Distribuir Processo",
        description: "EF172 - Processo Bancário - Selecionar Analista",
        module: null,
        function_sigla: "CE",
        baseline_factor_sigla: "I",
        category_sigla: null,
        complexity: "Baixa",
        pf_bruto: 3,
        pf_fs_baseline: 3,
        is_measurable: true,
        notes: null,
        product_reference: "GESP3",
        project_reference: "Projeto GESP3",
        measurement_reference: "Baseline inicial",
      },
    ],
    ...overrides,
  };
}

describe("project baseline counting", () => {
  it("usa alteração como fator padrão para função existente", () => {
    expect(inferImpactFactor(
      "Distribuir processos bancários para um analista",
      ["I", "A", "E"],
    )).toBe("A");
  });

  it("reconhece exclusão, migração e correção", () => {
    expect(inferImpactFactor("Excluir processo bancário", ["A", "E"]))
      .toBe("E");
    expect(inferImpactFactor("Migrar os processos legados", ["A", "PMD"]))
      .toBe("PMD");
    expect(inferImpactFactor("Corrigir erro na distribuição", ["A", "COR50"]))
      .toBe("COR50");
  });

  it("aceita correspondência determinística somente com candidato dominante", () => {
    expect(hasDeterministicProcessMatch([
      candidate({ match_score: 0.86 }),
      candidate({ process_ref: "EF200", match_score: 0.52 }),
    ])).toBe(true);
    expect(hasDeterministicProcessMatch([
      candidate({ match_score: 0.8 }),
      candidate({ process_ref: "EF200", match_score: 0.76 }),
    ])).toBe(false);
  });

  it("seleciona somente a linha EE quando a HU descreve distribuição", () => {
    const items = buildProjectBaselineItems({
      candidates: [candidate()],
      selectedProcessRefs: ["EF172"],
      factorSigla: "A",
      huRef: "HU-031",
      evidence: "Distribuir processos bancários",
      confidence: 0.86,
      reasoning: "Correspondência dominante",
      matchType: "baseline_process_exact",
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      baseline_item_id: "item-ee",
      function_sigla: "EE",
      factor_sigla: "A",
      complexity: "Baixa",
    });
  });

  it("preserva todas as linhas para revisão quando a HU não as diferencia", () => {
    const items = buildProjectBaselineItems({
      candidates: [candidate()],
      selectedProcessRefs: ["EF172"],
      factorSigla: "A",
      huRef: "HU-031",
      evidence: "Manutenção no processo bancário",
      confidence: 0.6,
      reasoning: "Processo identificado, itens ambíguos",
      matchType: "baseline_process_ai",
    });

    expect(items).toHaveLength(3);
    expect(items.every((item) => item.factor_sigla === "A")).toBe(true);
  });

  it("recusa processos que não pertencem aos candidatos", () => {
    expect(() => buildProjectBaselineItems({
      candidates: [candidate()],
      selectedProcessRefs: ["EF999"],
      factorSigla: "A",
      huRef: "HU-031",
      evidence: "Texto",
      confidence: 0.5,
      reasoning: "",
      matchType: "baseline_process_ai",
    })).toThrow("Os itens selecionados não pertencem à baseline ativa.");
  });

  it("interpreta referências de processo e fator do JSON da IA", () => {
    expect(parseProcessSelection(`
      \`\`\`json
      {
        "process_refs": ["ef172"],
        "factor_sigla": "a",
        "confidence": 0.81,
        "reasoning": "Processo bancário"
      }
      \`\`\`
    `)).toEqual({
      processRefs: ["EF172"],
      factorSigla: "A",
      confidence: 0.81,
      reasoning: "Processo bancário",
    });
  });
});
