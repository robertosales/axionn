import { useSprintReport } from "../hooks/useSprintReport";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, FileSpreadsheet, CheckCircle2, Clock, Zap } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  blocked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const PRIORITY_ICON: Record<string, string> = { high: "🔴", medium: "🟡", low: "🔵", critical: "🟣" };

export function SprintReportPage() {
  const { sprints, selected, setSelected, report, loading, downloadCSV, downloadPDF } = useSprintReport();

  return (
    <div className="space-y-5 p-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Relatório de Sprint</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Selecione o sprint" /></SelectTrigger>
            <SelectContent>
              {sprints.map(s => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.name}{s.is_active ? " ●" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={downloadCSV} disabled={!report}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={downloadPDF} disabled={!report}>
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : report ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: <CheckCircle2 className="h-4 w-4" />, label: "Concluídas", value: `${report.doneHUs}/${report.totalHUs}`, sub: `${report.totalHUs > 0 ? Math.round((report.doneHUs/report.totalHUs)*100) : 0}%` },
              { icon: <Zap className="h-4 w-4" />, label: "Pontos", value: `${report.donePoints}/${report.totalPoints}`, sub: "story points" },
              { icon: <Clock className="h-4 w-4" />, label: "Horas estimadas", value: `${report.totalHours}h`, sub: "total do sprint" },
              { icon: <FileText className="h-4 w-4" />, label: "Período", value: report.startDate?.slice(0,10) ?? "", sub: `→ ${report.endDate?.slice(0,10) ?? ""}` },
            ].map(k => (
              <div key={k.label} className="rounded-xl border border-border bg-card p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">{k.icon}<span className="text-[11px]">{k.label}</span></div>
                <p className="text-xl font-bold leading-none">{k.value}</p>
                <p className="text-[11px] text-muted-foreground">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Tabela de HUs */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Código</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Título</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Responsável</th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Epic</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Pts</th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {report.hus.map(hu => (
                    <tr key={hu.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                      <td className="py-2 px-3 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{hu.code}</td>
                      <td className="py-2 px-3 max-w-[240px]">
                        <div className="flex items-center gap-1.5">
                          {hu.priority && <span title={hu.priority}>{PRIORITY_ICON[hu.priority] ?? ""}</span>}
                          <span className="truncate">{hu.title}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          STATUS_COLORS[hu.status] ?? "bg-muted text-muted-foreground"
                        }`}>{hu.status}</span>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{hu.assignee_name}</td>
                      <td className="py-2 px-3">
                        {hu.epic && <Badge variant="outline" className="text-[9px]">{hu.epic}</Badge>}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">{hu.story_points ?? "—"}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{hu.estimated_hours != null ? `${hu.estimated_hours}h` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Selecione um sprint para gerar o relatório.
        </div>
      )}
    </div>
  );
}
