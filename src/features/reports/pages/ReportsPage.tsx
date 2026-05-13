import { useEffect, useState } from "react";
import { useReports } from "../hooks/useReports";
import { Button }  from "@/components/ui/button";
import { Badge }   from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, RefreshCw, FileJson } from "lucide-react";
import type { ReportType } from "../hooks/useReports";

const REPORT_TYPES: { value: ReportType; label: string; description: string }[] = [
  { value: "sprint_summary",    label: "Resumo do Sprint",       description: "Todas as HUs com status, pontos e responsável" },
  { value: "velocity",          label: "Velocity por Sprint",    description: "Pontos planejados vs entregues por sprint" },
  { value: "dev_performance",   label: "Performance por Dev",    description: "HUs, pontos e cycle time por desenvolvedor" },
  { value: "impediments",       label: "Impedimentos",           description: "Todos os impedimentos com tempo de resolução" },
];

export function ReportsPage() {
  const { rows, columns, loading, filter, sprints, devs, loadMeta, generate, exportCSV, exportJSON } = useReports();
  const [reportType, setReportType] = useState<ReportType>("sprint_summary");
  const [sprintId,   setSprintId]   = useState("");

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const handleGenerate = () => generate({ reportType, sprintId: sprintId || undefined });

  const selectedReport = REPORT_TYPES.find(r => r.value === reportType);

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Relatórios
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Gere e exporte relatórios do time em CSV ou JSON.</p>
        </div>
        {rows.length > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportJSON}>
              <FileJson className="h-3.5 w-3.5" /> JSON
            </Button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold">Parâmetros</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Tipo de Relatório</label>
            <Select value={reportType} onValueChange={v => setReportType(v as ReportType)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{REPORT_TYPES.map(r => <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>)}</SelectContent>
            </Select>
            {selectedReport && <p className="text-[10px] text-muted-foreground">{selectedReport.description}</p>}
          </div>
          {(reportType === "sprint_summary" || reportType === "burndown") && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Sprint (opcional)</label>
              <Select value={sprintId} onValueChange={setSprintId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos os sprints" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-xs">Todos</SelectItem>
                  {sprints.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-end">
            <Button size="sm" className="h-8 text-xs gap-1.5 w-full" onClick={handleGenerate} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Gerando..." : "Gerar Relatório"}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
      ) : rows.length > 0 ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold">{selectedReport?.label}</span>
            <Badge variant="secondary" className="text-[10px]">{rows.length} registros</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {columns.map(col => (
                    <th key={col} className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                        {val === null || val === undefined ? <span className="text-muted-foreground">—</span> :
                          typeof val === "number" ? val :
                          String(val).length > 60 ? String(val).slice(0, 57) + "..." : String(val)
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <FileText className="h-10 w-10 opacity-20" />
          <p className="text-sm">Configure os parâmetros e clique em Gerar Relatório.</p>
        </div>
      )}
    </div>
  );
}
