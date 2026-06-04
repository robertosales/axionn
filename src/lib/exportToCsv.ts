/**
 * Exporta um array de objetos planos como arquivo CSV (UTF-8 BOM para Excel).
 *
 * @example
 * exportToCsv({
 *   filename: 'sla-compliance-acme',
 *   rows: [{ ID: '1', Status: 'Violado' }],
 * });
 */
export function exportToCsv({
  filename,
  rows,
  separator = ';',
}: {
  filename: string;
  rows: Record<string, string | number | boolean | null | undefined>[];
  separator?: string;
}): void {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);

  function escape(v: unknown): string {
    const s = v == null ? '' : String(v);
    // Encapsula em aspas se contiver separador, aspas ou quebra de linha
    if (s.includes(separator) || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  const lines = [
    headers.map(escape).join(separator),
    ...rows.map(r => headers.map(h => escape(r[h])).join(separator)),
  ];

  // BOM UTF-8 garante abertura correta no Excel
  const bom  = '\uFEFF';
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href     = url;
  anchor.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();

  URL.revokeObjectURL(url);
}
