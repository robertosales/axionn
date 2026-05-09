export function exportToCSV(
  rows: Record<string, any>[],
  columns: { key: string; label: string }[],
  filename: string,
) {
  const visibleCols = columns.filter((c) => !c.key.startsWith("_"));
  const header = visibleCols.map((c) => `"${c.label}"`).join(",");
  const body = rows
    .map((row) =>
      visibleCols
        .map((c) => {
          const val = row[c.key] ?? "";
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");
  const csv = `${header}\n${body}`;
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
