import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSprintHistory } from "../hooks/useSprintHistory";
import { SprintHistoryFiltersBar } from "../components/SprintHistoryFilters";
import { SprintHistoryTable }     from "../components/SprintHistoryTable";
import { VelocityChart }          from "../components/VelocityChart";
import { TeamComparativoChart }   from "../components/TeamComparativoChart";
import { SprintDetailDrawer }     from "../components/SprintDetailDrawer";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge }   from "@/components/ui/badge";
import type { SprintMetrics } from "../hooks/useSprintHistory";

export function AdminHistoricoPage() {
  const { teams } = useAuth();
  const { metrics, teamComparativo, loading, filters, setFilters } = useSprintHistory();
  const [selected, setSelected] = useState<SprintMetrics | null>(null);

  return (
    <div className="space-y-6">
      {/* Header + Filtros */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Histórico de Sprints</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? "Carregando..." : <>{metrics.length} sprint{metrics.length !== 1 ? "s" : ""} encerrado{metrics.length !== 1 ? "s" : ""} <Badge variant="outline" className="text-[10px] ml-1">{filters.periodo === "all" ? "todo o histórico" : `últimos ${filters.periodo}`}</Badge></>}
          </p>
        </div>
        <SprintHistoryFiltersBar filters={filters} teams={teams} onChange={setFilters} />
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {/* Gráfico velocity */}
          <VelocityChart metrics={metrics} />

          {/* Comparativo entre times (só quando "Todos os times") */}
          {filters.teamId === "all" && teamComparativo.length > 1 && (
            <TeamComparativoChart comparativo={teamComparativo} />
          )}

          {/* Tabela de sprints */}
          <SprintHistoryTable metrics={metrics} onSelect={setSelected} />
        </>
      )}

      {/* Drawer de detalhe */}
      <SprintDetailDrawer sprint={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
