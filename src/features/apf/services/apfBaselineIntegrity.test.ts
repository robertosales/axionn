import { describe, expect, it } from "vitest";
import type { ParsedApfBaselineWorkbook } from "./apfBaselineParser";
import { validateApfBaselineIntegrity } from "./apfBaselineIntegrity";

function baseline(
  overrides: Partial<ParsedApfBaselineWorkbook> = {},
): ParsedApfBaselineWorkbook {
  return {
    scope: "project",
    systemName: "GESP3",
    measurementTitle: "Baseline funcional do projeto",
    referenceDate: "2026-06-08",
    expectedPfBruto: 10,
    expectedPfFs: 10,
    processCount: 1,
    warnings: [],
    functionTypes: [
      {
        sigla: "EE",
        name: "EE",
        func_class: "transactional",
        weight: 3,
        weights_by_complexity: { Baixa: 3 },
        sort_order: 1,
      },
      {
        sigla: "CE",
        name: "CE",
        func_class: "transactional",
        weight: 3,
        weights_by_complexity: { Baixa: 3, Média: 4 },
        sort_order: 2,
      },
    ],
    impactFactors: [
      {
        sigla: "A",
        name: "Alteração",
        contribution_pct: 60,
        action_on_baseline: "Alterar",
        origin: "Oficial",
        is_inm: false,
        sort_order: 1,
        notes: null,
      },
      {
        sigla: "I",
        name: "Inclusão",
        contribution_pct: 100,
        action_on_baseline: "Incluir",
        origin: "Oficial",
        is_inm: false,
        sort_order: 2,
        notes: null,
      },
    ],
    items: [
      {
        item_ref: "EF172:EE:10",
        process_ref: "EF172",
        process_name: "Processo Bancário - Distribuir Processo",
        description: "EF172 - Processo Bancário - Distribuir Processo",
        module: null,
        product_reference: "GESP3",
        project_reference: "Projeto GESP3",
        measurement_reference: "Baseline inicial",
        function_sigla: "EE",
        factor_sigla: "I",
        category_sigla: null,
        complexity: "Baixa",
        pf_bruto: 3,
        contribution_pct: 100,
        pf_fs: 3,
        is_measurable: true,
        notes: null,
        source_row: 10,
        source_payload: {},
      },
      {
        item_ref: "EF172:CE:11",
        process_ref: "EF172",
        process_name: "Processo Bancário - Distribuir Processo",
        description: "EF172 - Processo Bancário - Listar Processos",
        module: null,
        product_reference: "GESP3",
        project_reference: "Projeto GESP3",
        measurement_reference: "Baseline inicial",
        function_sigla: "CE",
        factor_sigla: "I",
        category_sigla: null,
        complexity: "Média",
        pf_bruto: 4,
        contribution_pct: 100,
        pf_fs: 4,
        is_measurable: true,
        notes: null,
        source_row: 11,
        source_payload: {},
      },
      {
        item_ref: "EF172:CE:12",
        process_ref: "EF172",
        process_name: "Processo Bancário - Distribuir Processo",
        description: "EF172 - Processo Bancário - Selecionar Analista",
        module: null,
        product_reference: "GESP3",
        project_reference: "Projeto GESP3",
        measurement_reference: "Baseline inicial",
        function_sigla: "CE",
        factor_sigla: "I",
        category_sigla: null,
        complexity: "Baixa",
        pf_bruto: 3,
        contribution_pct: 100,
        pf_fs: 3,
        is_measurable: true,
        notes: null,
        source_row: 12,
        source_payload: {},
      },
    ],
    ...overrides,
  };
}

describe("validateApfBaselineIntegrity", () => {
  it("aprova pesos diferentes quando tipo e complexidade também são diferentes", () => {
    const result = validateApfBaselineIntegrity(baseline());

    expect(result.errors).toEqual([]);
    expect(result.itemCount).toBe(3);
    expect(result.processCount).toBe(1);
    expect(result.measurableCount).toBe(3);
    expect(result.calculatedPfBruto).toBe(10);
    expect(result.calculatedPfSimples).toBe(10);
  });

  it("bloqueia pesos divergentes para o mesmo tipo e complexidade", () => {
    const source = baseline();
    source.items.push({
      ...source.items[2],
      item_ref: "EF173:CE:13",
      process_ref: "EF173",
      description: "EF173 - Outra consulta baixa",
      pf_bruto: 4,
      pf_fs: 4,
    });
    source.expectedPfBruto = 14;
    source.expectedPfFs = 14;

    const result = validateApfBaselineIntegrity(source);

    expect(result.errors).toContain(
      "CE/Baixa possui pesos divergentes: 3, 4.",
    );
  });

  it("bloqueia PF Simples diferente da fórmula", () => {
    const source = baseline();
    source.items[0] = { ...source.items[0], pf_fs: 2.5 };
    source.expectedPfFs = 9.5;

    const result = validateApfBaselineIntegrity(source);

    expect(result.errors).toContain(
      "EF172:EE:10: PF Simples 2.50 diverge do cálculo 3.00.",
    );
  });

  it("bloqueia divergência entre totais declarados e soma dos itens", () => {
    const result = validateApfBaselineIntegrity(baseline({
      expectedPfBruto: 2014,
      expectedPfFs: 2014,
    }));

    expect(result.errors).toContain(
      "PF Bruto total divergente: planilha 2014.00, itens 10.00.",
    );
    expect(result.errors).toContain(
      "PF Simples total divergente: planilha 2014.00, itens 10.00.",
    );
  });

  it("bloqueia referência interna duplicada", () => {
    const source = baseline();
    source.items.push({ ...source.items[0] });
    source.expectedPfBruto = 13;
    source.expectedPfFs = 13;

    const result = validateApfBaselineIntegrity(source);

    expect(result.errors).toContain(
      "Referência interna duplicada: EF172:EE:10.",
    );
  });
});
