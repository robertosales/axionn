import * as XLSX from "xlsx";

export interface ParsedBaselineItem {
  item_ref: string;
  process_ref: string;
  process_name: string;
  description: string;
  module: string | null;
  product_reference: string | null;
  project_reference: string | null;
  measurement_reference: string | null;
  function_sigla: string;
  factor_sigla: string;
  category_sigla: string | null;
  complexity: string;
  pf_bruto: number;
  contribution_pct: number;
  pf_fs: number;
  is_measurable: boolean;
  notes: string | null;
  source_row: number;
  source_payload: Record<string, unknown>;
}

export interface ParsedFunctionType {
  sigla: string;
  name: string;
  func_class: "transactional" | "data";
  weight: number;
  weights_by_complexity: Record<string, number>;
  sort_order: number;
}

export interface ParsedImpactFactor {
  sigla: string;
  name: string;
  contribution_pct: number;
  action_on_baseline: string;
  origin: string | null;
  is_inm: boolean;
  sort_order: number;
  notes: string | null;
}

export interface ParsedApfBaselineWorkbook {
  scope: "project";
  systemName: string | null;
  measurementTitle: string | null;
  referenceDate: string | null;
  expectedPfBruto: number | null;
  expectedPfFs: number | null;
  processCount: number;
  items: ParsedBaselineItem[];
  functionTypes: ParsedFunctionType[];
  impactFactors: ParsedImpactFactor[];
  warnings: string[];
}

type CellValue = string | number | boolean | Date | null | undefined;
type SheetMatrix = CellValue[][];

function text(value: CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function normalized(value: CellValue): string {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slug(value: string): string {
  return normalized(value).replace(/\s+/g, "-").slice(0, 120) || "item";
}

function numberValue(value: CellValue): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = text(value);
  if (!raw) return null;
  const compact = raw.replace(/\s/g, "");
  const normalizedNumber = compact.includes(",")
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact;
  const parsed = Number(normalizedNumber.replace(/[^0-9+\-.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function percentage(value: CellValue): number | null {
  const parsed = numberValue(value);
  if (parsed == null) return null;
  return parsed > 0 && parsed <= 1 ? parsed * 100 : parsed;
}

function matrix(workbook: XLSX.WorkBook, sheetName: string): SheetMatrix {
  const sheet = workbook.Sheets[sheetName];
  return sheet
    ? XLSX.utils.sheet_to_json<CellValue[]>(sheet, { header: 1, raw: true, defval: null })
    : [];
}

function findSheet(workbook: XLSX.WorkBook, aliases: string[]): string | null {
  const desired = aliases.map(normalized);
  return workbook.SheetNames.find((name) => desired.includes(normalized(name))) ?? null;
}

function findHeaderRow(rows: SheetMatrix, required: string[][]): number {
  return rows.findIndex((row) => {
    const cells = row.map(normalized);
    return required.every((aliases) => aliases.some((alias) => cells.includes(normalized(alias))));
  });
}

function columnMap(row: CellValue[]): Map<string, number> {
  return new Map(
    row
      .map((value, index): [string, number] => [normalized(value), index])
      .filter(([key]) => Boolean(key)),
  );
}

function column(columns: Map<string, number>, aliases: string[]): number {
  for (const alias of aliases) {
    const index = columns.get(normalized(alias));
    if (index != null) return index;
  }
  return -1;
}

function cell(row: CellValue[], index: number): CellValue {
  return index >= 0 ? row[index] : null;
}

function extractProcessRefs(...values: string[]): string[] {
  const refs = new Set<string>();
  for (const value of values) {
    for (const match of value.matchAll(/\bEF\s*0*(\d+)\b/gi)) {
      refs.add(`EF${String(Number(match[1])).padStart(3, "0")}`);
    }
  }
  return [...refs];
}

function cleanProcessName(description: string): string {
  return description
    .replace(/\b(?:INTERNET|INTRANET)\b/gi, " ")
    .replace(/\bEF\s*0*\d+(?:\s*\/\s*EF\s*0*\d+)*\b/gi, " ")
    .replace(/^\s*\d+(?:\.\d+)*\.?\s*/g, "")
    .replace(/\s*-\s*$/g, "")
    .replace(/^\s*-\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function complexityKey(value: string): string {
  const key = normalized(value);
  if (key.includes("baixa")) return "Baixa";
  if (key.includes("media")) return "Média";
  if (key.includes("alta")) return "Alta";
  return "Padrão";
}

function parseItems(rows: SheetMatrix, warnings: string[]): ParsedBaselineItem[] {
  const headerIndex = findHeaderRow(rows, [
    ["Item", "Funcionalidade", "Funcionalidade / EF"],
    ["Tipo", "Tipo de Função"],
    ["PF Bruto"],
    ["PF FS", "PF-FS"],
  ]);
  if (headerIndex < 0) throw new Error("A aba Itens não contém o cabeçalho esperado.");

  const columns = columnMap(rows[headerIndex]);
  const descriptionIndex = column(columns, ["Item", "Funcionalidade", "Funcionalidade / EF"]);
  const moduleIndex = column(columns, ["Módulo", "Modulo", "Subprocesso"]);
  const typeIndex = column(columns, ["Tipo", "Tipo de Função"]);
  const inmIndex = column(columns, ["INM", "Item Não Mensurável"]);
  const factorIndex = column(columns, ["Impacto", "Fator", "Fator de Impacto"]);
  const categoryIndex = column(columns, ["Categoria", "Categoria Funcional"]);
  const complexityIndex = column(columns, ["Complexidade", "Complex."]);
  const pfBrutoIndex = column(columns, ["PF Bruto"]);
  const contributionIndex = column(columns, ["Contribuição", "Contribuição FS", "% FS", "Percentual", "FA FS"]);
  const pfFsIndex = column(columns, ["PF FS", "PF-FS"]);
  const productReferenceIndex = column(columns, ["Referência do Produto", "Referencia do Produto"]);
  const projectReferenceIndex = column(columns, ["Referência do Projeto", "Referencia do Projeto"]);
  const measurementReferenceIndex = column(columns, ["Medição de Referência", "Medicao de Referencia"]);
  const notesIndex = column(columns, ["Comentário do Item", "Observação", "Observações", "Justificativa", "Notas"]);

  const parsed: ParsedBaselineItem[] = [];
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const description = text(cell(row, descriptionIndex));
    if (!description) continue;

    const rawType = text(cell(row, typeIndex)).toUpperCase();
    const rawInm = text(cell(row, inmIndex)).toUpperCase();
    const rawFactor = text(cell(row, factorIndex)).toUpperCase();
    const pfBruto = numberValue(cell(row, pfBrutoIndex)) ?? 0;
    const pfFsFromSheet = numberValue(cell(row, pfFsIndex));
    let contributionPct = percentage(cell(row, contributionIndex));
    if (contributionPct == null && pfBruto > 0 && pfFsFromSheet != null) {
      contributionPct = Math.round((pfFsFromSheet / pfBruto) * 10000) / 100;
    }
    contributionPct ??= rawType && rawType !== "N/A" ? 100 : 0;
    const pfFs = pfFsFromSheet ?? Math.round(pfBruto * contributionPct) / 100;
    const measurable = Boolean(
      rawType
      && rawType !== "N/A"
      && !rawInm
      && pfBruto > 0
      && contributionPct > 0,
    );

    const productReference = text(cell(row, productReferenceIndex)) || null;
    const projectReference = text(cell(row, projectReferenceIndex)) || null;
    const measurementReference = text(cell(row, measurementReferenceIndex)) || null;
    const refs = extractProcessRefs(
      description,
      productReference ?? "",
      projectReference ?? "",
      measurementReference ?? "",
    );
    const processRef = refs.length
      ? refs.join("+")
      : `${measurable && ["ALI", "AIE"].includes(rawType) ? "DATA" : "ITEM"}:${slug(description)}`;
    const processName = cleanProcessName(description) || description;
    const uniqueItemRef = `${processRef}:${measurable ? rawType : rawInm || "N-A"}:${rowIndex + 1}`;

    parsed.push({
      item_ref: uniqueItemRef,
      process_ref: processRef,
      process_name: processName,
      description,
      module: text(cell(row, moduleIndex)) || null,
      product_reference: productReference,
      project_reference: projectReference,
      measurement_reference: measurementReference,
      function_sigla: measurable ? rawType : "N/A",
      factor_sigla: measurable ? (rawFactor || "I") : "N/A",
      category_sigla: measurable ? null : (rawInm || null),
      complexity: complexityKey(text(cell(row, complexityIndex)) || "Padrão"),
      pf_bruto: Math.round(pfBruto * 100) / 100,
      contribution_pct: Math.round(contributionPct * 100) / 100,
      pf_fs: Math.round(pfFs * 100) / 100,
      is_measurable: measurable,
      notes: text(cell(row, notesIndex)) || null,
      source_row: rowIndex + 1,
      source_payload: Object.fromEntries(
        row.map((value, index) => [text(rows[headerIndex][index]) || `col_${index + 1}`, value]),
      ),
    });
  }

  const processNames = new Map<string, string>();
  for (const item of parsed) {
    const current = processNames.get(item.process_ref);
    if (!current || item.process_name.length < current.length) {
      processNames.set(item.process_ref, item.process_name);
    }
  }
  for (const item of parsed) {
    item.process_name = processNames.get(item.process_ref) ?? item.process_name;
  }

  const rowRefs = parsed.filter((item) => item.process_ref.startsWith("ITEM:"));
  if (rowRefs.length) {
    warnings.push(`${rowRefs.length} item(ns) não possuem código EF e serão localizados pelo nome funcional.`);
  }
  return parsed;
}

function deriveFunctionTypes(items: ParsedBaselineItem[]): ParsedFunctionType[] {
  const grouped = new Map<string, Map<string, number[]>>();
  items.filter((item) => item.is_measurable).forEach((item) => {
    const complexities = grouped.get(item.function_sigla) ?? new Map<string, number[]>();
    const values = complexities.get(item.complexity) ?? [];
    values.push(item.pf_bruto);
    complexities.set(item.complexity, values);
    grouped.set(item.function_sigla, complexities);
  });

  return [...grouped.entries()].map(([sigla, complexities], index) => {
    const weightsByComplexity: Record<string, number> = {};
    const allWeights: number[] = [];
    for (const [complexity, values] of complexities) {
      const frequencies = new Map<number, number>();
      values.forEach((weight) => {
        allWeights.push(weight);
        frequencies.set(weight, (frequencies.get(weight) ?? 0) + 1);
      });
      weightsByComplexity[complexity] = [...frequencies.entries()]
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
    }

    const defaultWeight = weightsByComplexity.Padrão
      ?? [...new Map(allWeights.map((weight) => [
        weight,
        allWeights.filter((value) => value === weight).length,
      ])).entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0]
      ?? 0;

    return {
      sigla,
      name: sigla,
      func_class: ["ALI", "AIE"].includes(sigla) ? "data" : "transactional",
      weight: defaultWeight,
      weights_by_complexity: weightsByComplexity,
      sort_order: index + 1,
    };
  });
}

function parseImpactFactors(rows: SheetMatrix, items: ParsedBaselineItem[]): ParsedImpactFactor[] {
  const headerIndex = findHeaderRow(rows, [["Sigla"], ["Contribuição", "Contribuição FS", "Percentual"]]);
  const factors = new Map<string, ParsedImpactFactor>();
  if (headerIndex >= 0) {
    const columns = columnMap(rows[headerIndex]);
    const nameIndex = column(columns, ["Fator", "Nome", "Descrição"]);
    const siglaIndex = column(columns, ["Sigla"]);
    const pctIndex = column(columns, ["Contribuição", "Contribuição FS", "Percentual", "Contribuição (FS)"]);
    const actionIndex = column(columns, ["Ação Baseline", "Ação na Baseline", "Ação Sobre o Baseline"]);
    const originIndex = column(columns, ["Origem", "Fonte"]);
    const notesIndex = column(columns, ["Observação", "Notas"]);
    for (let index = headerIndex + 1; index < rows.length; index += 1) {
      const sigla = text(cell(rows[index], siglaIndex)).toUpperCase();
      const pct = percentage(cell(rows[index], pctIndex));
      if (!sigla || pct == null) continue;
      factors.set(sigla, {
        sigla,
        name: text(cell(rows[index], nameIndex)) || sigla,
        contribution_pct: pct,
        action_on_baseline: text(cell(rows[index], actionIndex)) || (pct > 0 ? "Incluir/Alterar" : "Não Impacta"),
        origin: text(cell(rows[index], originIndex)) || null,
        is_inm: sigla === "N/A" || pct === 0,
        sort_order: index - headerIndex,
        notes: text(cell(rows[index], notesIndex)) || null,
      });
    }
  }

  items.forEach((item) => {
    if (!factors.has(item.factor_sigla)) {
      factors.set(item.factor_sigla, {
        sigla: item.factor_sigla,
        name: item.factor_sigla === "I" ? "Inclusão" : item.factor_sigla === "A" ? "Alteração" : item.factor_sigla,
        contribution_pct: item.contribution_pct,
        action_on_baseline: item.is_measurable ? "Incluir/Alterar" : "Não Impacta",
        origin: "Planilha importada",
        is_inm: !item.is_measurable,
        sort_order: factors.size + 1,
        notes: null,
      });
    }
  });
  return [...factors.values()];
}

function findLabeledNumber(rows: SheetMatrix, aliases: string[]): number | null {
  for (const row of rows) {
    for (let index = 0; index < row.length; index += 1) {
      if (aliases.some((alias) => normalized(row[index]).includes(normalized(alias)))) {
        for (let next = index + 1; next < row.length; next += 1) {
          const value = numberValue(row[next]);
          if (value != null) return value;
        }
      }
    }
  }
  return null;
}

function findLabeledText(rows: SheetMatrix, aliases: string[]): string | null {
  for (const row of rows) {
    for (let index = 0; index < row.length; index += 1) {
      if (aliases.some((alias) => normalized(row[index]).includes(normalized(alias)))) {
        for (let next = index + 1; next < row.length; next += 1) {
          const value = text(row[next]);
          if (value) return value;
        }
      }
    }
  }
  return null;
}

export function parseApfBaselineArrayBuffer(buffer: ArrayBuffer): ParsedApfBaselineWorkbook {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const itemsSheet = findSheet(workbook, ["Itens"]);
  if (!itemsSheet) throw new Error("A planilha não possui a aba obrigatória 'Itens'.");

  const warnings: string[] = [];
  const itemRows = matrix(workbook, itemsSheet);
  const items = parseItems(itemRows, warnings);
  if (!items.length) throw new Error("Nenhum item APF foi encontrado na aba Itens.");

  const factorSheet = findSheet(workbook, ["Fator Impacto", "Fator de Impacto"]);
  const measurementSheet = findSheet(workbook, ["Medição", "Medicao"]);
  const summarySheet = findSheet(workbook, ["Sumário", "Sumario"]);
  const measurementRows = measurementSheet ? matrix(workbook, measurementSheet) : [];
  const summaryRows = summarySheet ? matrix(workbook, summarySheet) : [];

  const expectedPfBruto = findLabeledNumber(measurementRows, ["PF Bruto"])
    ?? findLabeledNumber(summaryRows, ["PF Bruto"]);
  const expectedPfFs = findLabeledNumber(measurementRows, ["PF FS", "PF-FS"])
    ?? findLabeledNumber(summaryRows, ["PF FS", "PF-FS"]);
  const calculatedPfBruto = Math.round(items.reduce((sum, item) => sum + item.pf_bruto, 0) * 100) / 100;
  const calculatedPfFs = Math.round(items.reduce((sum, item) => sum + item.pf_fs, 0) * 100) / 100;
  if (expectedPfBruto != null && Math.abs(expectedPfBruto - calculatedPfBruto) > 0.02) {
    warnings.push(`PF Bruto da planilha (${expectedPfBruto}) difere da soma dos itens (${calculatedPfBruto}).`);
  }
  if (expectedPfFs != null && Math.abs(expectedPfFs - calculatedPfFs) > 0.02) {
    warnings.push(`PF FS da planilha (${expectedPfFs}) difere da soma dos itens (${calculatedPfFs}).`);
  }

  return {
    scope: "project",
    systemName: findLabeledText(measurementRows, ["Sistema", "Projeto"])
      ?? findLabeledText(summaryRows, ["Sistema", "Projeto"]),
    measurementTitle: findLabeledText(measurementRows, ["Título da Medição", "Medição", "Medicao", "Descrição", "Descricao"]),
    referenceDate: findLabeledText(measurementRows, ["Data de Referência", "Data", "Referência", "Referencia"]),
    expectedPfBruto,
    expectedPfFs,
    processCount: new Set(items.map((item) => item.process_ref)).size,
    items,
    functionTypes: deriveFunctionTypes(items),
    impactFactors: parseImpactFactors(factorSheet ? matrix(workbook, factorSheet) : [], items),
    warnings,
  };
}
