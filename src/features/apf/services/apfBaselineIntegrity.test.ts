import { describe, expect, it } from "vitest";
import type { ParsedApfBaselineWorkbook } from "./apfBaselineParser";
import { validateApfBaselineIntegrity } from "./apfBaselineIntegrity";

function baseline(
  overrides: Partial<ParsedApfBaselineWorkbook> = {},
): ParsedApfBaselineWorkbook {
  return {
    systemName: "GESP3",
    measurementTitle: "Sprint 01",
    referenceDate: "2026-06-08",
    expectedPfBruto: 11.6,
    expectedPfFs: 9.76,
    warnings: [],
    functionTypes: [
      { sigla: "TRN", name: "Transação", func_class: "transactional", weight: 4.6, sort_order: 1 },
      { sigla: "ARQ", name: "Arquivo", func_class: "data", weight: 7, sort_order: 2 },
    ],
    impactFactors: [
      { sigla: "A", name: "Alteração", contribution_pct: 60, action_on_baseline: "Alterar", origin: "Oficial", is_inm: false, sort_order: 1, notes: null },
      { sigla: "I", name: "Inclusão", contribution_pct: 100, action_on_baseline: "Incluir", origin: "Oficial", is_inm: false, sort_order: 2, notes: null },
    ],
    items: [
      {
        item_ref: "HU200",
        description: "HU200 PROC BANCÁRIO - Distribuir Processo Bancário",
        module: null,
        function_sigla: "TRN",
        factor_sigla: "A",
        category_sigla: null,
        complexity: "Padrão",
        pf_bruto: 4.6,
        contribution_pct: 60,
        pf_fs: 2.76,
        is_measurable: true,
        notes: null,
        source_row: 10,
        source_payload: {},
      },
      {
        item_ref: "ARQ-1",
        description: "Processo Bancário",
        module: null,
        function_sigla: "ARQ",
        factor_sigla: "I",
        category_sigla: null,
        complexity: "Padrão",
        pf_bruto: 7,
        contribution_pct: 100,
        pf_fs: 7,
        is_measurable: true,
        notes: null,
        source_row: 11,
        source_payload: {},
      },
    ],
    ...overrides,
  };
}

describe("validateApfBaselineIntegrity", () => {
  it("aprova a baseline contratual com PF Bruto e PF Simples consistentes", () => {
    const result = validateApfBaselineIntegrity(baseline());

    expect(result.errors).toEqual([]);
    expect(result.itemCount).toBe(2);
    expect(result.measurableCount).toBe(2);
    expect(result.calculatedPfBruto).toBe(11.6);
    expect(result.calculatedPfSimples).toBe(9.76);
  });

  it("bloqueia pesos divergentes para o mesmo tipo contratual", () => {
    const source = baseline();
    source.items.push({
      ...source.items[0],
      item_ref: "HU201",
      description: "HU201 Outra transação",
      pf_bruto: 3,
      pf_fs: 1.8,
    });
    source.expectedPfBruto = 14.6;
    source.expectedPfFs = 11.56;

    const result = validateApfBaselineIntegrity(source);

    expect(result.errors).toContain("O tipo TRN possui pesos divergentes: 4.6, 3.");
  });

  it("bloqueia PF Simples diferente da fórmula contratual", () => {
    const source = baseline();
    source.items[0] = { ...source.items[0], pf_fs: 3 };
    source.expectedPfFs = 10;

    const result = validateApfBaselineIntegrity(source);

    expect(result.errors).toContain(
      "HU200: PF Simples 3.00 diverge do cálculo 2.76.",
    );
  });

  it("bloqueia divergência entre totais declarados e soma dos itens", () => {
    const result = validateApfBaselineIntegrity(baseline({
      expectedPfBruto: 106,
      expectedPfFs: 99.52,
    }));

    expect(result.errors).toContain(
      "PF Bruto total divergente: planilha 106.00, itens 11.60.",
    );
    expect(result.errors).toContain(
      "PF Simples total divergente: planilha 99.52, itens 9.76.",
    );
  });
});
