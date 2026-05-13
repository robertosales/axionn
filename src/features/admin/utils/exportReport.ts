import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { ReportPayload } from "../hooks/useReportBuilder";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d?: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR");
}
function pct(v: number) { return `${v}%`; }
function hrs(v: number) { return `${v}h`; }
function sign(v: number) { return (v > 0 ? "+" : "") + v + "h"; }

// ── PDF ───────────────────────────────────────────────────────────────────────
export function exportToPDF(payload: ReportPayload) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const { config, kpis, sprints, comparativo } = payload;
  const geradoEm = new Date().toLocaleString("pt-BR");

  // Cabeçalho
  doc.setFontSize(16);
  doc.setTextColor(30, 30, 80);
  doc.text("Relatório Consolidado — Sistema AXION", 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Gerado em: ${geradoEm}  |  Período: ${config.periodoLabel}  |  Times: ${config.teamLabel}`, 40, 56);

  let y = 72;

  // ─ Seção KPIs Globais ───────────────────────────────────────────────────
  if (config.includeKpis && kpis) {
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 80);
    doc.text("KPIs Globais", 40, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [["Métrica", "Valor"]],
      body: [
        ["Total de times",          String(kpis.totalTimes)],
        ["Times Sala Ágil",         String(kpis.timesSalaAgil)],
        ["Times Sustentação",       String(kpis.timesSustentacao)],
        ["HUs no sprint ativo",      String(kpis.totalHUs)],
        ["HUs concluídas (ativo)",   String(kpis.husConcluidasAtivas)],
        ["Velocity total",           `${kpis.velocityPontos} pts`],
        ["Impedimentos abertos",     String(kpis.impedimentosAbertos)],
        ["Demandas abertas",         String(kpis.demandasAbertas)],
        ["SLA em risco",             String(kpis.slaEmRisco)],
      ],
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 255] },
      columnStyles: { 0: { cellWidth: 180 }, 1: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  // ─ Seção Velocity por Sprint ────────────────────────────────────────────
  if (config.includeSprints && sprints.length > 0) {
    if (y > 450) { doc.addPage(); y = 40; }
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 80);
    doc.text("Histórico de Sprints", 40, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [["Sprint", "Time", "Início", "Fim", "HUs", "Conclusão", "Velocity", "Hrs Plan.", "Hrs Real.", "Desvio", "Impedit."]],
      body: sprints.map(s => [
        s.sprintName,
        s.teamName,
        fmtDate(s.startDate),
        fmtDate(s.endDate),
        `${s.husConcluidadas}/${s.totalHUs}`,
        pct(s.taxaConclusao),
        String(s.velocityPontos),
        hrs(s.horasPlanejadas),
        hrs(s.horasRealizadas),
        sign(s.desvioHoras),
        String(s.impedimentos),
      ]),
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 248, 255] },
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  // ─ Seção Comparativo entre Times ────────────────────────────────────────
  if (config.includeComparativo && comparativo.length > 0) {
    if (y > 450) { doc.addPage(); y = 40; }
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 80);
    doc.text("Comparativo entre Times", 40, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [["Time", "Módulo", "Sprints", "Velocity méd.", "Conclusão méd.", "Desvio Hrs méd.", "Impedimentos"]],
      body: comparativo.map(t => [
        t.teamName, t.module === "sala_agil" ? "Sala Ágil" : "Sustentação",
        String(t.totalSprints),
        `${t.avgVelocity} pts`,
        pct(t.avgTaxaConclusao),
        sign(t.avgDesvioHoras),
        String(t.totalImpedimentos),
      ]),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [240, 255, 248] },
    });
  }

  const filename = `AXION_Relatorio_${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
}

// ── Excel ─────────────────────────────────────────────────────────────────────
export function exportToExcel(payload: ReportPayload) {
  const { config, kpis, sprints, comparativo } = payload;
  const wb = XLSX.utils.book_new();

  // Aba 1 — KPIs
  if (config.includeKpis && kpis) {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Métrica", "Valor"],
      ["Total de times",         kpis.totalTimes],
      ["Times Sala Ágil",        kpis.timesSalaAgil],
      ["Times Sustentação",      kpis.timesSustentacao],
      ["HUs no sprint ativo",     kpis.totalHUs],
      ["HUs concluídas (ativo)",  kpis.husConcluidasAtivas],
      ["Velocity total (pts)",    kpis.velocityPontos],
      ["Impedimentos abertos",    kpis.impedimentosAbertos],
      ["Demandas abertas",        kpis.demandasAbertas],
      ["SLA em risco",            kpis.slaEmRisco],
    ]);
    ws["!cols"] = [{ wch: 30 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, "KPIs Globais");
  }

  // Aba 2 — Sprints
  if (config.includeSprints && sprints.length > 0) {
    const headers = ["Sprint","Time","Início","Fim","HUs Total","HUs Concluídas","Conclusão %","Velocity","Hrs Planejadas","Hrs Realizadas","Desvio Hrs","Impedimentos"];
    const rows = sprints.map(s => [
      s.sprintName, s.teamName,
      fmtDate(s.startDate), fmtDate(s.endDate),
      s.totalHUs, s.husConcluidadas,
      s.taxaConclusao, s.velocityPontos,
      s.horasPlanejadas, s.horasRealizadas,
      s.desvioHoras, s.impedimentos,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [{ wch: 24 }, { wch: 18 }, ...Array(10).fill({ wch: 14 })];
    XLSX.utils.book_append_sheet(wb, ws, "Sprints");
  }

  // Aba 3 — Comparativo
  if (config.includeComparativo && comparativo.length > 0) {
    const headers = ["Time","Módulo","Sprints","Velocity méd.","Conclusão méd. %","Desvio Hrs méd.","Impedimentos"];
    const rows = comparativo.map(t => [
      t.teamName,
      t.module === "sala_agil" ? "Sala Ágil" : "Sustentação",
      t.totalSprints, t.avgVelocity,
      t.avgTaxaConclusao, t.avgDesvioHoras,
      t.totalImpedimentos,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [{ wch: 20 }, { wch: 16 }, ...Array(5).fill({ wch: 16 })];
    XLSX.utils.book_append_sheet(wb, ws, "Comparativo Times");
  }

  const filename = `AXION_Relatorio_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
