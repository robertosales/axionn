import type { OkrObjective } from "../types";

type KrRow = {
  cycle: string;
  team: string;
  owner: string;
  objectiveTitle: string;
  objectiveHealth: string;
  objectiveProgress: string;
  krTitle: string;
  unit: string;
  baseline: number | null;
  target: number | null;
  current: number | null;
  krProgress: string;
  krHealth: string;
  updateType: string;
};

function flattenObjectives(objectives: OkrObjective[], cycle: string): KrRow[] {
  const rows: KrRow[] = [];
  for (const obj of objectives) {
    const base = {
      cycle,
      team: obj.team_name ?? "",
      owner: obj.owner_name ?? "",
      objectiveTitle: obj.title,
      objectiveHealth: obj.manual_health_override ?? obj.calculated_health ?? "",
      objectiveProgress: obj.calculated_progress != null ? `${Math.round(obj.calculated_progress)}%` : "",
    };
    if (!obj.key_results?.length) {
      rows.push({ ...base, krTitle: "", unit: "", baseline: null, target: null, current: null, krProgress: "", krHealth: "", updateType: "" });
    } else {
      for (const kr of obj.key_results) {
        rows.push({
          ...base,
          krTitle: kr.title,
          unit: kr.unit,
          baseline: kr.baseline_value,
          target: kr.target_value ?? kr.target,
          current: kr.current_value ?? kr.current,
          krProgress: kr.calculated_progress != null ? `${Math.round(kr.calculated_progress)}%` : "",
          krHealth: kr.calculated_health ?? "",
          updateType: kr.update_type,
        });
      }
    }
  }
  return rows;
}

function toCSV(rows: KrRow[]): string {
  const headers = ["Ciclo", "Time", "Responsável", "Objetivo", "Saúde Objetivo", "Progresso Objetivo", "Key Result", "Unidade", "Baseline", "Meta", "Atual", "Progresso KR", "Saúde KR", "Tipo Atualização"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(",")];
  for (const r of rows) {
    lines.push([
      r.cycle, r.team, r.owner, r.objectiveTitle, r.objectiveHealth, r.objectiveProgress,
      r.krTitle, r.unit, r.baseline?.toString() ?? "", r.target?.toString() ?? "", r.current?.toString() ?? "",
      r.krProgress, r.krHealth, r.updateType,
    ].map(escape).join(","));
  }
  return "\uFEFF" + lines.join("\n");
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportOkrsToCSV(objectives: OkrObjective[], cycle: string) {
  const rows = flattenObjectives(objectives, cycle);
  const csv = toCSV(rows);
  const safeCycle = cycle.replace("/", "-");
  download(csv, `okr-${safeCycle}.csv`, "text/csv;charset=utf-8");
}

export async function exportOkrsToPDF(objectives: OkrObjective[], cycle: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const rows = flattenObjectives(objectives, cycle);
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(`OKR — ${cycle}`, 14, 20);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);

  autoTable(doc, {
    startY: 34,
    head: [["Ciclo", "Time", "Responsável", "Objetivo", "Saúde", "KR", "Unidade", "Meta", "Atual", "Progresso"]],
    body: rows.map(r => [
      r.cycle, r.team, r.owner, r.objectiveTitle, r.objectiveHealth,
      r.krTitle, r.unit, r.target?.toString() ?? "", r.current?.toString() ?? "", r.krProgress,
    ]),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  const safeCycle = cycle.replace("/", "-");
  doc.save(`okr-${safeCycle}.pdf`);
}
