import { ReactNode, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TableColumn<T = any> {
  key: string;
  header: string;
  render?: (value: any, row: T) => ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  width?: string;
}

interface ReportDataTableProps<T = any> {
  title?: string;
  subtitle?: string;
  columns: TableColumn<T>[];
  data: T[];
  rowKey?: (row: T) => string | number;
  emptyMessage?: string;
  maxRows?: number;
  badge?: string | number;
}

export function ReportDataTable<T extends Record<string, any>>({
  title,
  subtitle,
  columns,
  data,
  rowKey,
  emptyMessage = "Nenhum dado encontrado.",
  maxRows,
  badge,
}: ReportDataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const perPage = maxRows ?? 15;

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return sortDir === "asc" ? cmp : -cmp;
      })
    : data;

  const pageCount = Math.ceil(sorted.length / perPage);
  const paged = sorted.slice(page * perPage, page * perPage + perPage);

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(0);
  }

  return (
    <Card>
      {(title || subtitle) && (
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            {title && <CardTitle className="text-sm font-semibold">{title}</CardTitle>}
            {badge !== undefined && (
              <Badge variant="secondary" className="text-[10px] font-mono">{badge}</Badge>
            )}
          </div>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </CardHeader>
      )}
      <CardContent className={cn(!title && !subtitle ? "pt-4" : "pt-0")}>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap",
                          col.align === "center" && "text-center",
                          col.align === "right" && "text-right",
                          col.sortable && "cursor-pointer select-none hover:text-foreground transition-colors",
                          col.width,
                        )}
                        onClick={() => col.sortable && handleSort(col.key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.header}
                          {col.sortable && (
                            sortKey === col.key ? (
                              sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronsUpDown className="h-3 w-3 opacity-40" />
                            )
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row, idx) => (
                    <tr
                      key={rowKey ? rowKey(row) : idx}
                      className={cn(
                        "border-t transition-colors hover:bg-muted/30",
                        idx % 2 !== 0 && "bg-muted/10",
                      )}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "px-3 py-2.5 align-middle",
                            col.align === "center" && "text-center",
                            col.align === "right" && "text-right",
                          )}
                        >
                          {col.render ? col.render(row[col.key], row) : row[col.key] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && (
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <span>
                  {page * perPage + 1}–{Math.min((page + 1) * perPage, sorted.length)} de {sorted.length}
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Anterior</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Próximo →</Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
