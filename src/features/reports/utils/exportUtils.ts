// Exportação CSV e PDF (sem dependência externa para CSV, usa window.print para PDF)

export function exportToCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv = [
    headers.map(escape).join(","),
    ...rows.map(r => r.map(escape).join(",")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToPDF(title: string, htmlContent: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; color: #111; }
      h1 { font-size: 18px; margin-bottom: 16px; }
      h2 { font-size: 14px; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: #f8fafc; text-align: left; padding: 6px 8px; font-size: 11px; border-bottom: 2px solid #e2e8f0; }
      td { padding: 5px 8px; font-size: 11px; border-bottom: 1px solid #f1f5f9; }
      tr:nth-child(even) td { background: #f8fafc; }
      .badge { display: inline-block; padding: 1px 6px; border-radius: 999px; font-size: 10px; }
      .badge-success { background: #dcfce7; color: #166534; }
      .badge-warning { background: #fef9c3; color: #854d0e; }
      .badge-error   { background: #fee2e2; color: #991b1b; }
      .meta { font-size: 10px; color: #64748b; margin-bottom: 16px; }
      @media print { body { padding: 0; } }
    </style>
    </head><body>
    ${htmlContent}
    <script>window.onload = () => { window.print(); }<\/script>
    </body></html>
  `);
  win.document.close();
}
