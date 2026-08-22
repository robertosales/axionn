import { formatCurrencyBRL, parseBRLInput } from "@/lib/currency";

export async function exportInvoicesToPdf(rows: Array<{
  cliente: string; plano: string; valor: string; vencimento: string; status: string; periodo: string;
}>, filename: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const geradoEm = new Date().toLocaleString("pt-BR");

  doc.setFontSize(14);
  doc.setTextColor(30, 30, 80);
  doc.text("Relatório de Faturas — Backoffice Axion", 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Gerado em: ${geradoEm}  |  Total: ${rows.length} fatura(s)  |  Uso restrito: Roberto Sales LTDA`, 40, 56);

  autoTable(doc, {
    startY: 72,
    head: [["Cliente", "Plano", "Valor", "Vencimento", "Status", "Período"]],
    body: rows.map((r) => [r.cliente, r.plano, r.valor, r.vencimento, r.status, r.periodo]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 30, 80] },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    margin: { left: 40, right: 40 },
  });

  doc.save(`${filename}-${new Date().toISOString().slice(0, 10)}.pdf`);
}