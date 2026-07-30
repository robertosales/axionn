import { supabase } from "@/integrations/supabase/client";
import { logUserUsageEvent, TelemetryEvents } from "@/lib/telemetry";
import type {
  OkrExportPayloadV2,
  OkrExportRowV2,
} from "../types/dashboard";

type OkrExportFormat = "csv" | "pdf";

interface ExportRpcClient {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: Error | null }>;
}

const CSV_HEADERS = [
  "Ciclo",
  "Time",
  "Objetivo",
  "Nível",
  "Status",
  "Saúde do objetivo",
  "Progresso do objetivo",
  "Key Result",
  "Unidade",
  "Direção",
  "Baseline",
  "Meta",
  "Atual",
  "Progresso do KR",
  "Saúde do KR",
  "Qualidade da medição",
  "Última medição",
] as const;

function safeSpreadsheetValue(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value: unknown): string {
  return `"${safeSpreadsheetValue(value).replace(/"/g, '""')}"`;
}

export function buildOkrExportCsv(rows: OkrExportRowV2[]): string {
  const body = rows.map((row) =>
    [
      row.cycle_code,
      row.team_name,
      row.objective_title,
      row.objective_level,
      row.objective_lifecycle,
      row.objective_health,
      row.objective_progress,
      row.key_result_title,
      row.key_result_unit,
      row.key_result_direction,
      row.key_result_baseline,
      row.key_result_target,
      row.key_result_current,
      row.key_result_progress,
      row.key_result_health,
      row.measurement_quality,
      row.last_measured_at
        ? new Date(row.last_measured_at).toLocaleString("pt-BR")
        : "",
    ]
      .map(csvCell)
      .join(","),
  );

  return `\uFEFF${[CSV_HEADERS.map(csvCell).join(","), ...body].join("\n")}`;
}

function downloadBlob(content: BlobPart, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function requestExport(
  organizationId: string,
  cycleIds: string[],
  format: OkrExportFormat,
): Promise<OkrExportPayloadV2> {
  const { data, error } = await (supabase as unknown as ExportRpcClient).rpc(
    "request_okr_export_v1",
    {
      p_org_id: organizationId,
      p_cycle_ids: cycleIds,
      p_format: format,
    },
  );
  if (error) throw error;
  return data as OkrExportPayloadV2;
}

function exportFilename(cycleCodes: string[], extension: string) {
  const scope = cycleCodes.length
    ? cycleCodes.join("-vs-").replace(/[^a-zA-Z0-9_-]+/g, "-")
    : "todos-os-ciclos";
  return `okr-${scope}.${extension}`;
}

export async function exportOkrV2(args: {
  organizationId: string;
  cycleIds: string[];
  cycleCodes: string[];
  format: OkrExportFormat;
}): Promise<OkrExportPayloadV2> {
  const startedAt = performance.now();
  const payload = await requestExport(
    args.organizationId,
    args.cycleIds,
    args.format,
  );

  if (args.format === "csv") {
    downloadBlob(
      buildOkrExportCsv(payload.rows),
      exportFilename(args.cycleCodes, "csv"),
      "text/csv;charset=utf-8",
    );
  } else {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Axionn · Relatório executivo de OKRs", 14, 18);
    doc.setFontSize(9);
    doc.text(
      `Ciclos: ${args.cycleCodes.join(" × ") || "Todos"} · Gerado em ${new Date().toLocaleString("pt-BR")}`,
      14,
      25,
    );
    autoTable(doc, {
      startY: 31,
      head: [[
        "Ciclo",
        "Time",
        "Objetivo",
        "Saúde",
        "Progresso",
        "Key Result",
        "Meta",
        "Atual",
        "Progresso KR",
      ]],
      body: payload.rows.map((row) => [
        row.cycle_code,
        row.team_name,
        row.objective_title,
        row.objective_health,
        row.objective_progress == null
          ? "Sem dados"
          : `${Math.round(row.objective_progress)}%`,
        row.key_result_title ?? "—",
        row.key_result_target ?? "—",
        row.key_result_current ?? "—",
        row.key_result_progress == null
          ? "Sem dados"
          : `${Math.round(row.key_result_progress)}%`,
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [30, 64, 175] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    doc.save(exportFilename(args.cycleCodes, "pdf"));
  }

  void logUserUsageEvent({
    event_type: TelemetryEvents.REPORT_EXPORTED,
    entity_type: "okr_dashboard",
    source: "web",
    metadata_json: {
      format: args.format,
      cycle_count: args.cycleIds.length,
      row_count: payload.rows.length,
      duration_ms: Math.round(performance.now() - startedAt),
    },
  });

  return payload;
}
