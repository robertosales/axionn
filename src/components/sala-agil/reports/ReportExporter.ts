import { ReportConfig } from './types';
import { formatMinutes } from '@/lib/duration';

// ─── Helper: decimal → minutos → string formatada
function fmtH(decimalHours: number | null | undefined): string {
  const n = Number(decimalHours ?? 0);
  return formatMinutes(isFinite(n) ? Math.round(n * 60) : 0);
}

// ─── Tipos internos
export interface ActivityRow {
  id: string;
  code: string;
  title: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  hours: number;        // decimal interno (ex: 1.25 = 1h 15min)
  huCode: string;
  huTitle?: string;
  developerName: string;
  developerRole: string;
}

export interface ReportData {
  sprintName: string;
  sprintStart?: string;
  sprintEnd?: string;
  periodStart: string;
  periodEnd: string;
  teamName: string;
  activities: ActivityRow[];
  developers: { id: string; name: string; role: string }[];
}

// ─── Helper: agrupar por HU
function groupByHU(acts: ActivityRow[]) {
  const map = new Map<string, { huCode: string; huTitle: string; acts: ActivityRow[]; subtotalMin: number }>();
  for (const a of acts) {
    const key = a.huCode || 'SEM-HU';
    if (!map.has(key)) map.set(key, { huCode: a.huCode || '—', huTitle: a.huTitle || '', acts: [], subtotalMin: 0 });
    const g = map.get(key)!;
    g.acts.push(a);
    // Acumula em minutos para evitar erro de arredondamento de ponto flutuante
    g.subtotalMin += Math.round((Number(a.hours) || 0) * 60);
  }
  return [...map.values()];
}

// ─── CSV
function buildCSV(data: ReportData, scope: string): string {
  const headers = ['Membro','Cargo','Código','Título da Atividade','Status','Início','Fim','Duração','HU'];
  const devs = scope === 'all'
    ? data.developers
    : data.developers.filter(d => d.id === scope);

  const rows: string[][] = [];
  for (const dev of devs) {
    const acts   = data.activities.filter(a => a.developerName === dev.name);
    const groups = groupByHU(acts);
    let devTotalMin = 0;
    for (const g of groups) {
      if (g.huCode !== '—') rows.push([dev.name, dev.role, '', `=== ${g.huCode}${g.huTitle ? ' — ' + g.huTitle : ''} ===`, '', '', '', '', g.huCode]);
      for (const a of g.acts) {
        rows.push([dev.name, dev.role, a.code, a.title, a.status, a.startDate, a.endDate, fmtH(a.hours), a.huCode]);
      }
      rows.push([dev.name, '', `SUBTOTAL ${g.huCode}`, '', '', '', '', formatMinutes(g.subtotalMin), '']);
      devTotalMin += g.subtotalMin;
    }
    rows.push([dev.name, '', 'TOTAL', '', '', '', '', formatMinutes(devTotalMin), '']);
  }

  const escape = (s: string) => s.includes(',') || s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s;
  return [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
}

// ─── XLSX
async function buildXLSX(data: ReportData, scope: string, sprintName: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const devs = scope === 'all'
    ? data.developers
    : data.developers.filter(d => d.id === scope);

  for (const dev of devs) {
    const acts   = data.activities.filter(a => a.developerName === dev.name);
    const groups = groupByHU(acts);
    const headers = ['Código','Título da Atividade','Status','Início','Fim','Duração','HU'];
    const rows: (string | number)[][] = [];
    let devTotalMin = 0;
    for (const g of groups) {
      if (g.huCode !== '—') rows.push(['', `─── ${g.huCode}${g.huTitle ? ' — ' + g.huTitle : ''} ───`, '', '', '', '', g.huCode]);
      for (const a of g.acts) rows.push([a.code, a.title, a.status, a.startDate, a.endDate, fmtH(a.hours), a.huCode]);
      rows.push([`SUBTOTAL ${g.huCode}`, '', '', '', '', formatMinutes(g.subtotalMin), '']);
      devTotalMin += g.subtotalMin;
    }
    rows.push(['TOTAL', '', '', '', '', formatMinutes(devTotalMin), '']);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map((h, i) => ({ wch: i === 1 ? 50 : Math.max(h.length, 14) }));
    const sheetName = dev.name.split(' ').slice(0,2).join(' ').substring(0,31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  XLSX.writeFile(wb, `Produtividade_Faturamento_${sprintName}.xlsx`);
}

// ─── Cor primária Sala Ágil
const AGIL_PRIMARY: [number, number, number] = [22, 163, 74];

// ─── PDF
async function buildPDF(
  data: ReportData,
  scope: string,
  sprintName: string,
  emittedBy: string,
  reportTitle  = 'Relatório de Produtividade Individual — Faturamento',
  restrictLabel = 'Uso restrito — Setor de Faturamento',
) {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const devs = scope === 'all'
    ? data.developers
    : data.developers.filter(d => d.id === scope);

  const now         = new Date();
  const dateStr     = now.toLocaleDateString('pt-BR');
  const timeStr     = now.toLocaleTimeString('pt-BR');
  const periodStart = data.sprintStart || data.periodStart;
  const periodEnd   = data.sprintEnd   || data.periodEnd;

  devs.forEach((dev, idx) => {
    if (idx > 0) doc.addPage();

    // Cabeçalho
    doc.setFillColor(...AGIL_PRIMARY);
    doc.rect(0, 0, 297, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('Axion — Operações & Fluxo Ágil', 10, 9);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(reportTitle, 10, 17);
    doc.setFontSize(9);
    doc.text(`Emitido em: ${dateStr} às ${timeStr}  ·  Por: ${emittedBy}`, 160, 9, { align: 'left' });
    doc.text(restrictLabel, 160, 17, { align: 'left' });

    // Sub-header do membro
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text(dev.name, 10, 33);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const metaLine = [
      dev.role,
      sprintName,
      periodStart && periodEnd ? `${periodStart} → ${periodEnd}` : '',
      data.teamName ? `Time: ${data.teamName}` : '',
    ].filter(Boolean).join('  ·  ');
    doc.text(metaLine, 10, 39);
    doc.setDrawColor(226, 232, 240);
    doc.line(10, 42, 287, 42);

    // Tabela agrupada por HU
    const acts   = data.activities.filter(a => a.developerName === dev.name);
    const groups = groupByHU(acts);
    const totalMin = acts.reduce((s, a) => s + Math.round((Number(a.hours) || 0) * 60), 0);

    const body: (string | { content: string; styles?: object; colSpan?: number })[][] = [];

    for (const g of groups) {
      if (g.huCode !== '—') {
        body.push([{
          content: `${g.huCode}${g.huTitle ? '  —  ' + g.huTitle : ''}`,
          colSpan: 6,
          styles: { fillColor: [220, 252, 231], textColor: [4, 120, 87], fontStyle: 'bold', fontSize: 8 },
        }] as any);
      }
      for (const a of g.acts) {
        body.push([a.code, a.title, a.status, a.startDate, a.endDate, fmtH(a.hours)]);
      }
      if (groups.length > 1 || g.huCode !== '—') {
        body.push([{
          content: `SUBTOTAL ${g.huCode}`,
          colSpan: 5,
          styles: { fillColor: [241, 245, 249], textColor: [100, 116, 139], fontStyle: 'bold', fontSize: 8 },
        }, {
          content: formatMinutes(g.subtotalMin),
          styles: { fillColor: [241, 245, 249], textColor: AGIL_PRIMARY, fontStyle: 'bold', fontSize: 8 },
        }] as any);
      }
    }

    autoTable(doc, {
      head: [['Código', 'Título da Atividade', 'Status', 'Início', 'Fim', 'Duração']],
      body,
      startY: 46,
      styles:             { fontSize: 8, cellPadding: 2.5, lineColor: [226, 232, 240], lineWidth: 0.1 },
      headStyles:         { fillColor: AGIL_PRIMARY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 110 },
        2: { cellWidth: 28 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22, fontStyle: 'bold', textColor: AGIL_PRIMARY, halign: 'center' },
      },
    });

    const pageH = doc.internal.pageSize.height;
    doc.setFontSize(8); doc.setTextColor(148, 163, 184);
    doc.text(`Total: ${formatMinutes(totalMin)} lançadas  ·  ${acts.length} atividades`, 10, pageH - 8);
    doc.text('Assinatura: _______________________________', 187, pageH - 8);
  });

  doc.save(`Produtividade_Faturamento_${sprintName}.pdf`);
}

// ─── Entry point principal
export async function generateReport(
  config: ReportConfig,
  data: ReportData,
  emittedBy: string,
  preview = false,
  reportTitle?: string,
  restrictLabel?: string,
) {
  const sprint = data.sprintName;
  if (config.format === 'csv') {
    const csv  = buildCSV(data, config.memberScope);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Produtividade_Faturamento_${sprint}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } else if (config.format === 'xlsx') {
    await buildXLSX(data, config.memberScope, sprint);
  } else {
    await buildPDF(data, config.memberScope, sprint, emittedBy, reportTitle, restrictLabel);
  }
}
