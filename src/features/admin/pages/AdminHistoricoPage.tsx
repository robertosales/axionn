import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminKpis } from "../hooks/useAdminKpis";
import { useSprintHistory } from "../hooks/useSprintHistory";
import { useReportBuilder } from "../hooks/useReportBuilder";
import { exportToPDF, exportToExcel } from "../utils/exportReport";
import { SprintHistoryFiltersBar } from "../components/SprintHistoryFilters";
import { SprintHistoryTable }     from "../components/SprintHistoryTable";
import { VelocityChart }          from "../components/VelocityChart";
import { TeamComparativoChart }   from "../components/TeamComparativoChart";
import { SprintDetailDrawer }     from "../components/SprintDetailDrawer";
import { ReportConfigDialog }     from "../components/ReportConfigDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge }    from "@/components/ui/badge";
import { Button }   from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast }    from "sonner";
import type { SprintMetrics } from "../hooks/useSprintHistory";
import type { ReportConfig } from "../hooks/useReportBuilder";

export function AdminHistoricoPage() {
  const { teams } = useAuth();
  const { global: adminKpisGlobal } = useAdminKpis();
  const { metrics, teamComparativo, loading, filters, setFilters } = useSprintHistory();
  const { buildPayload } = useReportBuilder({
    adminKpis:      adminKpisGlobal,
    allMetrics:     metrics,
    allComparativo: teamComparativo,
    teams,
  });

  const [selected,      setSelected]      = useState<SprintMetrics | null>(null);
  const [reportOpen,    setReportOpen]    = useState(false);

  const handleExport = (config: ReportConfig, format: "pdf" | "excel") => {
    try {
      const payload = buildPayload(config);
      if (format === "pdf")   exportToPDF(payload);
      else                    exportToExcel(payload);
      toast.success(`Relatório ${format.toUpperCase()} gerado com sucesso!`);
      setReportOpen(false);
    } catch (e) {
      toast.error("Erro ao gerar relatório");
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Filtros + Botão exportar */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Histórico de Sprints</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? "Carregando..." : (
              <>{metrics.length} sprint{metrics.length !== 1 ? "s" : ""} encerrado{metrics.length !== 1 ? "s" : ""}{" "}
              <Badge variant="outline" className="text-[10px] ml-1">{filters.periodo === "all" ? "todo o histórico" : `últimos ${filters.periodo}`}</Badge></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SprintHistoryFiltersBar filters={filters} teams={teams} onChange={setFilters} />
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setReportOpen(true)}>
            <Download className="h-3.5 w-3.5" /> Exportar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <VelocityChart metrics={metrics} />
          {filters.teamId === "all" && teamComparativo.length > 1 && (
            <TeamComparativoChart comparativo={teamComparativo} />
          )}
          <SprintHistoryTable metrics={metrics} onSelect={setSelected} />
        </>
      )}

      <SprintDetailDrawer  sprint={selected}    onClose={() => setSelected(null)} />
      <ReportConfigDialog  open={reportOpen}    teams={teams} onClose={() => setReportOpen(false)} onExport={handleExport} />
    </div>
  );
}
