import * as XLSX from "xlsx";

/**
 * Lê uma planilha de Baseline APF e devolve uma tabela Markdown enxuta
 * com apenas as colunas estritamente necessárias para a IA.
 * Retorna `null` se não conseguir interpretar o arquivo.
 */
export async function baselineFileToMarkdown(file: File): Promise<string | null> {
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });

    const wsItens = wb.Sheets["Itens"] ?? wb.Sheets[wb.SheetNames[0]];
    if (!wsItens) return null;
    const raw: unknown[][] = XLSX.utils.sheet_to_json(wsItens, { header: 1, defval: null });

    // localiza header
    let headerIdx = 0;
    for (let r = 0; r < raw.length; r++) {
      if (String(raw[r]?.[0] ?? "").toLowerCase() === "item") { headerIdx = r; break; }
    }
    const header = (raw[headerIdx] ?? []) as string[];
    const col = (name: string) =>
      header.findIndex((h) => String(h ?? "").toLowerCase().includes(name.toLowerCase()));

    const iItem = col("item"), iTipo = col("tipo"), iComplex = col("complex");
    const iPfBruto = col("pf bruto"), iPfFs = col("pf fs"), iImpacto = col("impacto");

    const TIPOS = new Set(["ALI", "AIE", "SE", "CE", "EE"]);
    const rows: string[] = [];
    rows.push(`| Item | Tipo | Complexidade | PF Bruto | PF FS | Impacto |`);
    rows.push(`|------|------|--------------|----------|-------|---------|`);

    for (let r = headerIdx + 1; r < raw.length; r++) {
      const row = (raw[r] as unknown[]) ?? [];
      const tipo = String(row[iTipo] as string ?? "").trim().toUpperCase();
      const item = String(row[iItem] as string ?? "").trim();
      if (!item || !TIPOS.has(tipo)) continue;
      rows.push(
        `| ${item} | ${tipo} | ${String(row[iComplex] as string ?? "").trim()} | ${row[iPfBruto] as string ?? ""} | ${row[iPfFs] as string ?? ""} | ${String(row[iImpacto] as string ?? "").trim()} |`,
      );
    }

    if (rows.length <= 2) return null;
    return rows.join("\n");
  } catch (err) {
    console.error("baselineFileToMarkdown:", err);
    return null;
  }
}