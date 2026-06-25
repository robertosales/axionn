import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseApfBaselineArrayBuffer } from "./apfBaselineParser";

function createWorkbook(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Medição"],
      ["Sistema", "GESP3"],
      ["Título da Medição", "Baseline funcional do projeto"],
      ["PF Bruto", 20],
      ["PF FS", 20],
    ]),
    "Medição",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Itens da baseline"],
      [],
      [
        "Item",
        "Tipo",
        "INM",
        "Impacto",
        "Complexidade",
        "PF Bruto",
        "FA FS",
        "PF FS",
        "Referência do Produto",
        "Referência do Projeto",
        "Medição de Referência",
        "Comentário do Item",
      ],
      [
        "EF172 - Processo Bancário - Distribuir Processo - INTRANET",
        "EE",
        null,
        "I",
        "Baixa",
        3,
        1,
        3,
        "GESP3",
        "Projeto GESP3",
        "Baseline inicial",
        null,
      ],
      [
        "EF172 - Processo Bancário - Listar Processos Bancários",
        "CE",
        null,
        "I",
        "Média",
        4,
        1,
        4,
        "GESP3",
        "Projeto GESP3",
        "Baseline inicial",
        null,
      ],
      [
        "EF172 - Processo Bancário - Selecionar Analista (Combo)",
        "CE",
        null,
        "I",
        "Baixa",
        3,
        1,
        3,
        "GESP3",
        "Projeto GESP3",
        "Baseline inicial",
        null,
      ],
      [
        "EF010 - Cadastro de Unidade",
        "ALI",
        null,
        "I",
        "Baixa",
        7,
        1,
        7,
        "GESP3",
        "Projeto GESP3",
        "Baseline inicial",
        null,
      ],
      [
        "Documentação técnica interna",
        null,
        "DOC",
        "N/A",
        null,
        0,
        0,
        0,
        "GESP3",
        "Projeto GESP3",
        "Baseline inicial",
        "Não mensurável",
      ],
      [
        "Serviço auxiliar sem código EF",
        "SE",
        null,
        "I",
        "Baixa",
        3,
        1,
        3,
        "GESP3",
        "Projeto GESP3",
        "Baseline inicial",
        null,
      ],
    ]),
    "Itens",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Fator", "Sigla", "Ação Sobre o Baseline", "Contribuição (FS)", "Origem"],
      ["Inclusão", "I", "Incluir", 1, "Guia"],
      ["Alteração", "A", "Alterar", 0.6, "Guia"],
      ["Exclusão", "E", "Remover", 0.4, "Guia"],
      ["Não se Aplica", "N/A", "Não Impacta", 0, "Guia"],
    ]),
    "Fator Impacto",
  );

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("parseApfBaselineArrayBuffer", () => {
  it("trata a planilha como baseline do projeto e agrupa itens pelo código EF", () => {
    const parsed = parseApfBaselineArrayBuffer(createWorkbook());
    const ef172 = parsed.items.filter((item) => item.process_ref === "EF172");

    expect(parsed.scope).toBe("project");
    expect(parsed.systemName).toBe("GESP3");
    expect(parsed.processCount).toBe(4);
    expect(ef172).toHaveLength(3);
    expect(new Set(ef172.map((item) => item.item_ref)).size).toBe(3);
    expect(ef172.map((item) => item.process_name)).toEqual([
      "Processo Bancário - Distribuir Processo",
      "Processo Bancário - Distribuir Processo",
      "Processo Bancário - Distribuir Processo",
    ]);
  });

  it("preserva tipo, complexidade e PF Bruto de cada item oficial", () => {
    const parsed = parseApfBaselineArrayBuffer(createWorkbook());
    const distribution = parsed.items.find((item) =>
      item.description.includes("Distribuir Processo"));
    const query = parsed.items.find((item) =>
      item.description.includes("Listar Processos"));

    expect(distribution).toMatchObject({
      process_ref: "EF172",
      function_sigla: "EE",
      factor_sigla: "I",
      complexity: "Baixa",
      pf_bruto: 3,
      contribution_pct: 100,
      pf_fs: 3,
      is_measurable: true,
    });
    expect(query).toMatchObject({
      function_sigla: "CE",
      complexity: "Média",
      pf_bruto: 4,
    });
  });

  it("preserva itens não mensuráveis sem gerar PF", () => {
    const parsed = parseApfBaselineArrayBuffer(createWorkbook());
    const nonMeasurable = parsed.items.find((item) =>
      item.description === "Documentação técnica interna");

    expect(nonMeasurable).toMatchObject({
      function_sigla: "N/A",
      factor_sigla: "N/A",
      category_sigla: "DOC",
      pf_bruto: 0,
      contribution_pct: 0,
      pf_fs: 0,
      is_measurable: false,
    });
  });

  it("deriva pesos por tipo e complexidade e importa fatores de impacto", () => {
    const parsed = parseApfBaselineArrayBuffer(createWorkbook());

    expect(parsed.functionTypes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sigla: "CE",
        weights_by_complexity: { Média: 4, Baixa: 3 },
      }),
      expect.objectContaining({
        sigla: "EE",
        weights_by_complexity: { Baixa: 3 },
      }),
      expect.objectContaining({
        sigla: "ALI",
        func_class: "data",
        weights_by_complexity: { Baixa: 7 },
      }),
    ]));
    expect(parsed.impactFactors).toEqual(expect.arrayContaining([
      expect.objectContaining({ sigla: "A", contribution_pct: 60 }),
      expect.objectContaining({ sigla: "I", contribution_pct: 100 }),
      expect.objectContaining({ sigla: "E", contribution_pct: 40 }),
    ]));
  });

  it("mantém itens sem código EF pesquisáveis pelo nome funcional", () => {
    const parsed = parseApfBaselineArrayBuffer(createWorkbook());
    const item = parsed.items.find((entry) =>
      entry.description === "Serviço auxiliar sem código EF");

    expect(item?.process_ref).toBe("ITEM:servico-auxiliar-sem-codigo-ef");
    expect(parsed.warnings).toContain(
      "1 item(ns) não possuem código EF e serão localizados pelo nome funcional.",
    );
  });
});
