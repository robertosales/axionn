import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseApfBaselineArrayBuffer } from "./apfBaselineParser";

function workbookBuffer(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["Medição"],
    ["Sistema", "GESP3"],
    ["Título da Medição", "Baseline funcional do projeto"],
    ["PF Bruto", 20],
    ["PF FS", 20],
  ]), "Medição");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["Itens da baseline"],
    [],
    ["Item", "Tipo", "INM", "Impacto", "Complexidade", "PF Bruto", "FA FS", "PF FS", "Referência do Produto"],
    ["EF172 - Processo Bancário - Distribuir Processo - INTRANET", "EE", null, "I", "Baixa", 3, 1, 3, "GESP3"],
    ["EF172 - Processo Bancário - Listar Processos Bancários", "CE", null, "I", "Média", 4, 1, 4, "GESP3"],
    ["EF172 - Processo Bancário - Selecionar Analista (Combo)", "CE", null, "I", "Baixa", 3, 1, 3, "GESP3"],
    ["EF010 - Cadastro de Unidade", "ALI", null, "I", "Baixa", 7, 1, 7, "GESP3"],
    ["Documentação técnica interna", null, "DOC", "N/A", null, 0, 0, 0, "GESP3"],
    ["Serviço auxiliar sem código EF", "SE", null, "I", "Baixa", 3, 1, 3, "GESP3"],
  ]), "Itens");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["Fator", "Sigla", "Ação Sobre o Baseline", "Contribuição (FS)"],
    ["Inclusão", "I", "Incluir", 1],
    ["Alteração", "A", "Alterar", 0.6],
    ["Exclusão", "E", "Remover", 0.4],
    ["Não se Aplica", "N/A", "Não Impacta", 0],
  ]), "Fator Impacto");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("parseApfBaselineArrayBuffer", () => {
  it("agrupa linhas oficiais pelo código EF sem perder os itens", () => {
    const parsed = parseApfBaselineArrayBuffer(workbookBuffer());
    const ef172 = parsed.items.filter((item) => item.process_ref === "EF172");

    expect(parsed.scope).toBe("project");
    expect(parsed.processCount).toBe(4);
    expect(ef172).toHaveLength(3);
    expect(new Set(ef172.map((item) => item.item_ref)).size).toBe(3);
    expect(ef172.every((item) =>
      item.process_name === "Processo Bancário - Distribuir Processo"
    )).toBe(true);
  });

  it("preserva tipo, complexidade e PF Bruto de cada linha", () => {
    const parsed = parseApfBaselineArrayBuffer(workbookBuffer());
    expect(parsed.items.find((item) => item.description.includes("Distribuir")))
      .toMatchObject({ process_ref: "EF172", function_sigla: "EE", complexity: "Baixa", pf_bruto: 3 });
    expect(parsed.items.find((item) => item.description.includes("Listar")))
      .toMatchObject({ function_sigla: "CE", complexity: "Média", pf_bruto: 4 });
  });

  it("deriva pesos por tipo e complexidade e fatores contratuais", () => {
    const parsed = parseApfBaselineArrayBuffer(workbookBuffer());
    expect(parsed.functionTypes).toEqual(expect.arrayContaining([
      expect.objectContaining({ sigla: "CE", weights_by_complexity: { Média: 4, Baixa: 3 } }),
      expect.objectContaining({ sigla: "ALI", func_class: "data", weights_by_complexity: { Baixa: 7 } }),
    ]));
    expect(parsed.impactFactors).toEqual(expect.arrayContaining([
      expect.objectContaining({ sigla: "A", contribution_pct: 60 }),
      expect.objectContaining({ sigla: "E", contribution_pct: 40 }),
    ]));
  });

  it("mantém itens sem EF pesquisáveis pelo nome", () => {
    const parsed = parseApfBaselineArrayBuffer(workbookBuffer());
    expect(parsed.items.find((item) => item.description.startsWith("Serviço"))?.process_ref)
      .toBe("ITEM:servico-auxiliar-sem-codigo-ef");
    expect(parsed.warnings).toContain(
      "2 item(ns) não possuem código EF e serão localizados pelo nome funcional.",
    );
  });
});
