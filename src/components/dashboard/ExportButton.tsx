import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Table2, FileCode } from "lucide-react";
import { toast } from "sonner";

interface ExportData {
  headers: string[];
  rows: (string | number)[][];
  title: string;
}

// Extrai metadados codificados no title: "Título | Período | Doc: RPT-xxx | Gerado por: Nome"
function parseTitleMeta(title: string) {
  const parts = title.split(" | ");
  const rawTitle  = parts[0]?.trim() ?? title;
  const periodo   = parts[1]?.trim() ?? "";
  const docId     = parts.find(p => p.startsWith("RPT-"))?.trim() ?? "";
  const geradoPor = parts.find(p => p.startsWith("Gerado por:"))?.replace("Gerado por:", "").trim() ?? "Sistema";
  return { rawTitle, periodo, docId, geradoPor };
}

export function ExportButton({ getData }: { getData: () => ExportData }) {
  const [exporting, setExporting] = useState(false);

  const exportCSV = () => {
    const { headers, rows, title } = getData();
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => {
          const str = String(cell);
          return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(",")
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `${title}.csv`);
    toast.success("CSV exportado com sucesso!");
  };

  const exportXLSX = async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const { headers, rows, title } = getData();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      // largura automática por coluna
      ws["!cols"] = headers.map((h, ci) => ({
        wch: Math.min(
          Math.max(h.length, ...rows.map(r => String(r[ci] ?? "").length), 10),
          50
        ),
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dados");
      XLSX.writeFile(wb, `${title}.xlsx`);
      toast.success("Excel exportado com sucesso!");
    } catch (err) {
      toast.error("Erro ao exportar Excel");
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const { headers, rows, title } = getData();
      const { rawTitle, periodo, docId, geradoPor } = parseTitleMeta(title);

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const W  = doc.internal.pageSize.getWidth();
      const now = new Date();
      const dataHora = `${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

      // ── Cabeçalho padronizado (padrão feat/padroniza-cabecalho-pdf)
      doc.setFillColor(245, 245, 245);
      doc.rect(0, 0, W, 32, "F");

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(rawTitle, 12, 10);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);

      if (periodo) doc.text(`Período: ${periodo}`, 12, 17);
      doc.text(`Gerado por: ${geradoPor}`, 12, 23);
      doc.text(`Data: ${dataHora}`, 90, 23);
      if (docId) doc.text(`Doc: ${docId}`, W - 12, 23, { align: "right" });

      doc.setDrawColor(210, 210, 210);
      doc.line(12, 30, W - 12, 30);

      // ── Tabela de dados
      autoTable(doc, {
        head: [headers],
        body: rows.map((r) => r.map(String)),
        startY: 35,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 12, right: 12 },
      });

      // ── Paginação
      const total = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${total}`, W - 12, doc.internal.pageSize.getHeight() - 6, { align: "right" });
      }

      doc.save(`${rawTitle}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (err) {
      toast.error("Erro ao exportar PDF");
    } finally {
      setExporting(false);
    }
  };

  const exportMarkdown = () => {
    const { headers, rows, title } = getData();
    const { rawTitle, periodo, geradoPor } = parseTitleMeta(title);
    const now = new Date();

    let md = `# ${rawTitle}\n\n`;
    if (periodo)   md += `**Período:** ${periodo}  \n`;
    md += `**Gerado por:** ${geradoPor}  \n`;
    md += `**Data:** ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}  \n\n`;
    md += `| ${headers.join(" | ")} |\n`;
    md += `| ${headers.map(() => "---").join(" | ")} |\n`;
    rows.forEach(row => {
      md += `| ${row.map(c => String(c).replace(/\|/g, "\\|")).join(" | ")} |\n`;
    });
    md += `\n---\n*Total de registros: ${rows.length}*\n`;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    downloadBlob(blob, `${rawTitle}.md`);
    toast.success("Markdown exportado com sucesso!");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled={exporting}>
          <Download className="h-3.5 w-3.5" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportCSV} className="gap-2 text-xs">
          <Table2 className="h-3.5 w-3.5" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportXLSX} className="gap-2 text-xs">
          <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPDF} className="gap-2 text-xs">
          <FileText className="h-3.5 w-3.5" /> PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportMarkdown} className="gap-2 text-xs">
          <FileCode className="h-3.5 w-3.5" /> Markdown (.md)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
