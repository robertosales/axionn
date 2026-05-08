import { ReportConfig } from './types';

// ─── Tipos internos de dados que cada relatório consome
export interface ActivityRow {
  id: string;
  code: string;
  title: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  hours: number;
  huCode: string;
  developerName: string;
  developerRole: string;
}

export interface ReportData {
  sprintName: string;
  periodStart: string;
  periodEnd: string;
  teamName: string;
  activities: ActivityRow[];
  developers: { id: string; name: string; role: string }[];
}

// ─── Gerador de CSV
function buildCSV(data: ReportData, scope: string): string {
  const headers = ['Membro','Cargo','Código','Título','Tipo','Status','Início','Fim','Horas','HU'];
  const devs = scope === 'all'
    ? data.developers
    : data.developers.filter(d => d.id === scope);

  const rows: string[][] = [];
  for (const dev of devs) {
    const acts = data.activities.filter(a => a.developerName === dev.name);
    for (const a of acts) {
      rows.push([dev.name, dev.role, a.code, a.title, a.type, a.status, a.startDate, a.endDate, String(a.hours), a.huCode]);
    }
    // subtotal
    const totalH = acts.reduce((s, a) => s + a.hours, 0);
    rows.push([dev.name, '', '---SUBTOTAL---', '', '', '', '', '', String(totalH), '']);
  }

  const escape = (s: string) => s.includes(',') || s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s;
  return [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
}

// ─── Gerador de XLSX (1 aba por membro)
async function buildXLSX(data: ReportData, scope: string, sprintName: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const devs = scope === 'all'
    ? data.developers
    : data.developers.filter(d => d.id === scope);

  for (const dev of devs) {
    const acts = data.activities.filter(a => a.developerName === dev.name);
    const headers = ['Código','Título','Tipo','Status','Início','Fim','Horas','HU'];
    const rows = acts.map(a => [a.code, a.title, a.type, a.status, a.startDate, a.endDate, a.hours, a.huCode]);
    const totalH = acts.reduce((s, a) => s + a.hours, 0);
    rows.push(['---SUBTOTAL---', '', '', '', '', '', totalH, '']);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map((h, i) => ({ wch: i === 1 ? 45 : Math.max(h.length, 14) }));
    const sheetName = dev.name.split(' ').slice(0,2).join(' ').substring(0,31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  XLSX.writeFile(wb, `Produtividade_Faturamento_${sprintName}.xlsx`);
}

// ─── Gerador de PDF
async function buildPDF(data: ReportData, scope: string, sprintName: string, emittedBy: string) {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const devs = scope === 'all'
    ? data.developers
    : data.developers.filter(d => d.id === scope);

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR');

  devs.forEach((dev, idx) => {
    if (idx > 0) doc.addPage();

    // Cabeçalho institucional
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, 297, 22, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text('Axion — Operações & Fluxo Ágil', 10, 9);
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text('Relatório de Produtividade Individual — Faturamento', 10, 16);
    doc.text(`Emitido em: ${dateStr} às ${timeStr}  ·  Por: ${emittedBy}`, 180, 9);
    doc.text(`Uso restrito — Setor de Faturamento`, 180, 16);

    // Metadados do membro
    doc.setTextColor(15,23,42);
    doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text(dev.name, 10, 32);
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.setTextColor(100,116,139);
    doc.text(`${dev.role}  ·  ${sprintName}  ·  ${data.periodStart} → ${data.periodEnd}  ·  Time: ${data.teamName}`, 10, 38);

    // Linha separadora
    doc.setDrawColor(226,232,240);
    doc.line(10, 41, 287, 41);

    // Tabela de atividades
    const acts = data.activities.filter(a => a.developerName === dev.name);
    const totalH = acts.reduce((s,a) => s + a.hours, 0);

    autoTable(doc, {
      head: [['Código','Título da Atividade','Tipo','Status','Início','Fim','Horas','HU']],
      body: [
        ...acts.map(a => [a.code, a.title, a.type, a.status, a.startDate, a.endDate, `${a.hours}h`, a.huCode]),
        ['','SUBTOTAL','','','','',`${totalH}h`,''],
      ],
      startY: 45,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [99,102,241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248,250,252] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 90 },
        2: { cellWidth: 22 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 },
        6: { cellWidth: 16, fontStyle: 'bold', textColor: [59,130,246] },
        7: { cellWidth: 20 },
      },
      didDrawCell: (hookData) => {
        if (hookData.row.index === acts.length && hookData.section === 'body') {
          doc.setFillColor(238,242,255);
        }
      },
    });

    // Rodapé
    const pageH = doc.internal.pageSize.height;
    doc.setFontSize(8); doc.setTextColor(148,163,184);
    doc.text(`Total: ${totalH}h lançadas · ${acts.length} atividades`, 10, pageH - 8);
    doc.text('Assinatura: _______________________________', 180, pageH - 8);
  });

  doc.save(`Produtividade_Faturamento_${sprintName}.pdf`);
}

// ─── Entry point principal
export async function generateReport(config: ReportConfig, data: ReportData, emittedBy: string, preview = false) {
  const sprint = data.sprintName;
  if (config.format === 'csv') {
    const csv = buildCSV(data, config.memberScope);
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Produtividade_Faturamento_${sprint}.csv`; a.click();
    URL.revokeObjectURL(url);
  } else if (config.format === 'xlsx') {
    await buildXLSX(data, config.memberScope, sprint);
  } else {
    await buildPDF(data, config.memberScope, sprint, emittedBy);
  }
}
