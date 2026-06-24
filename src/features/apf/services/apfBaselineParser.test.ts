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
      ["Descrição", "Sprint de referência"],
      ["PF Bruto", 11.6],
      ["PF FS", 9.76],
    ]),
    "Medição",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Itens da medição"],
      [],
      [
        "Item",
        "Tipo",
        "Impacto",
        "Complexidade",
        "PF Bruto",
        "Contribuição FS",
        "PF FS",
        "Observação",
      ],
      ["HU200 PROC BANCÁRIO - Distribuir Processo Bancário", "TRN", "A", "Padrão", 4.6, 0.6, 2.76, null],
      ["Processo Bancário", "ARQ", "I", "Padrão", 7, 1, 7, null],
      ["HU999 Item agregador", "N/A", "N/A", null, 0, 0, 0, "Não mensurável"],
    ]),
    "Itens",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Fator", "Sigla", "Ação na Baseline", "Contribuição FS", "Origem"],
      ["Inclusão", "I", "Incluir/Alterar", 1, "Guia"],
      ["Alteração", "A", "Incluir/Alterar", 0.6, "Guia"],
      ["Não se Aplica", "N/A", "Não Impacta", 0, "Guia"],
    ]),
    "Fator Impacto",
  );

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("parseApfBaselineArrayBuffer", () => {
  it("normaliza percentuais e calcula PF FS contratual", () => {
    const parsed = parseApfBaselineArrayBuffer(createWorkbook());
    const hu200 = parsed.items.find((item) => item.item_ref === "HU200");

    expect(parsed.systemName).toBe("GESP3");
    expect(hu200).toMatchObject({
      function_sigla: "TRN",
      factor_sigla: "A",
      pf_bruto: 4.6,
      contribution_pct: 60,
      pf_fs: 2.76,
      is_measurable: true,
    });
  });

  it("preserva itens não mensuráveis sem gerar PF", () => {
    const parsed = parseApfBaselineArrayBuffer(createWorkbook());
    const nonMeasurable = parsed.items.find((item) => item.item_ref === "HU999");

    expect(nonMeasurable).toMatchObject({
      function_sigla: "N/A",
      factor_sigla: "N/A",
      pf_bruto: 0,
      contribution_pct: 0,
      pf_fs: 0,
      is_measurable: false,
    });
  });

  it("deriva pesos e fatores do conteúdo oficial", () => {
    const parsed = parseApfBaselineArrayBuffer(createWorkbook());

    expect(parsed.functionTypes).toEqual(expect.arrayContaining([
      expect.objectContaining({ sigla: "TRN", weight: 4.6 }),
      expect.objectContaining({ sigla: "ARQ", weight: 7 }),
    ]));
    expect(parsed.impactFactors).toEqual(expect.arrayContaining([
      expect.objectContaining({ sigla: "A", contribution_pct: 60 }),
      expect.objectContaining({ sigla: "I", contribution_pct: 100 }),
    ]));
    expect(parsed.warnings).toEqual([]);
  });
});
