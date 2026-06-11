import { useState, useMemo } from "react";
import { History, Download, FileText } from "lucide-react";
import { useAuth }             from "@/contexts/AuthContext";
import { useAdminKpis }        from "../hooks/useAdminKpis";
import { useSprintHistory }    from "../hooks/useSprintHistory";
import { useReportBuilder }    from "../hooks/useReportBuilder";
import { useContractContext }  from "../contexts/ContractContext";
import { exportToPDF, exportToExcel } from "../utils/exportReport";
import { SprintHistoryFiltersBar } from "../components/SprintHistoryFilters";
import { SprintHistoryTable }      from "../components/SprintHistoryTable";
import { VelocityChart }           from "../components/VelocityChart";
import { TeamComparativoChart }    from "../components/TeamComparativoChart";
import { SprintDetailDrawer }      from "../components/SprintDetailDrawer";
import { ReportConfigDialog }      from "../components/ReportConfigDialog";
import { PageHeader }              from "../components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { toast }    from "sonner";
import type { SprintMetrics } from "../hooks/useSprintHistory";
import type { ReportConfig }  from "../hooks/useReportBuilder";

export function AdminHistoricoPage() {
  const { teams: allTeams }   = useAuth();
  const { global: kpisG }     = useAdminKpis();
  const { selectedContractId, selectedContract } = useContractContext();
  const { metrics, teamComparativo, loading, filters, setFilters } = useSprintHistory(selectedContractId);
  const { buildPayload }    = useReportBuilder({ adminKpis: kpisG, allMetrics: metrics, allComparativo: teamComparativo, teams: allTeams });

  const [selected,   setSelected]   = useState<SprintMetrics | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  // Deduplica por id para evitar itens repetidos no dropdown
  const teams = useMemo(() => {
    const seen = new Set<string>();
    return allTeams.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [allTeams]);

  const handleExport = (config: ReportConfig, format: "pdf" | "excel") => {
    try {
      const payload = buildPayload(config);
      format === "pdf" ? exportToPDF(payload) : exportToExcel(payload);
      toast.success(`Relatório ${format.toUpperCase()} gerado com sucesso!`);
      setReportOpen(false);
    } catch (e) { toast.error("Erro ao gerar relatório"); console.error(e); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={History}
        iconColor="text-violet-400"
        description={
          loading ? "Carregando..."
          : `${metrics.length} sprint${metrics.length !== 1 ? "s" : ""} encerrado${metrics.length !== 1 ? "s" : ""}`
        }
        badges={[
          ...(!loading ? [{ label: filters.periodo === "all" ? "todo o histórico" : `últimos ${filters.periodo}` }] : []),
          ...(selectedContract ? [{ label: selectedContract.name, icon: FileText, className: "gap-1 text-[11px] font-medium text-amber-400 border-amber-400/50 bg-amber-400/5" }] : []),
        ]}
        actions={[{ label: "Exportar", icon: Download, onClick: () => setReportOpen(true), variant: "outline" }]}
      >
        <SprintHistoryFiltersBar filters={filters} teams={teams} onChange={setFilters} />
      </PageHeader>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : (
        <>
          <VelocityChart metrics={metrics} />
          {filters.teamId === "all" && teamComparativo.length > 1 && <TeamComparativoChart comparativo={teamComparativo} />}
          <SprintHistoryTable metrics={metrics} onSelect={setSelected} />
        </>
      )}

      <SprintDetailDrawer sprint={selected} onClose={() => setSelected(null)} />
      <ReportConfigDialog open={reportOpen} teams={teams} onClose={() => setReportOpen(false)} onExport={handleExport} />
    </div>
  );
}
