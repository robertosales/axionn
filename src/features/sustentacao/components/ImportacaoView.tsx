import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { SITUACAO_LABELS } from "../types/demanda";
import ImportacaoPreviewTable from "./ImportacaoPreviewTable";

// Mapeamento de labels legíveis para chaves internas de situação
const LABEL_TO_SITUACAO: Record<string, string> = Object.entries(SITUACAO_LABELS).reduce(
  (acc, [key, label]) => ({ ...acc, [label.toLowerCase()]: key }),
  {} as Record<string, string>
);

// Aliases adicionais para compatibilidade com planilhas
const LABEL_ALIASES: Record<string, string> = {
  "concluída": "fila_concluida",
  "concluida": "fila_concluida",
  "concluído": "fila_concluida",
  "concluido": "fila_concluida",
  "fila concluida": "fila_concluida",
  "fila_concluida": "fila_concluida",
};

function normalizeSituacao(raw: string): string {
  const normalized = String(raw).trim().toLowerCase();
  return LABEL_ALIASES[normalized] ?? LABEL_TO_SITUACAO[normalized] ?? raw;
}

function parseRow(row: Record<string, unknown>) {
  return {
    rhm: String(row["rhm"] ?? row["RHM"] ?? ""),
    titulo: String(row["titulo"] ?? row["Título"] ?? row["Titulo"] ?? ""),
    projeto: String(row["projeto"] ?? row["Projeto"] ?? ""),
    situacao: normalizeSituacao(String(row["situacao"] ?? row["Situação"] ?? row["Situacao"] ?? "")),
    tipo: String(row["tipo"] ?? row["Tipo"] ?? "manutencao_corretiva"),
    descricao: String(row["descricao"] ?? row["Descrição"] ?? row["Descricao"] ?? ""),
    demandante: String(row["demandante"] ?? row["Demandante"] ?? ""),
    responsavel_dev: String(row["responsavel_dev"] ?? row["Responsável Dev"] ?? row["Responsavel Dev"] ?? ""),
    sla: String(row["sla"] ?? row["SLA"] ?? "padrao"),
  };
}

async function parseFile(file: File): Promise<ReturnType<typeof parseRow>[]> {
  const isXlsx =
    file.name.endsWith(".xlsx") ||
    file.name.endsWith(".xls") ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel";

  if (isXlsx) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    return rows.map(parseRow);
  }

  // CSV
  const text = await file.text();
  const lines = text.split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => (row[h] = values[i] ?? ""));
    return parseRow(row);
  });
}

export default function ImportacaoView() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ReturnType<typeof parseRow>[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setLoading(true);
    setFileName(file.name);
    try {
      const parsed = await parseFile(file);
      setRows(parsed);
    } catch (err) {
      setError("Erro ao processar o arquivo. Verifique o formato e tente novamente.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setRows([]);
    setFileName("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Importação de Demandas</h2>
          <p className="text-sm text-muted-foreground">
            Importe demandas via arquivo <strong>.csv</strong> ou <strong>.xlsx</strong>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          {loading ? "Processando..." : "Selecionar Arquivo"}
        </Button>

        {fileName && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            {fileName}
          </span>
        )}

        {rows.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Limpar
          </Button>
        )}
      </div>

      {/* Input oculto — aceita CSV e Excel */}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        onChange={handleFileChange}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <strong>{rows.length}</strong> demanda(s) encontradas para importação.
          </p>
          <ImportacaoPreviewTable rows={rows} />
        </div>
      )}
    </div>
  );
}
