import { Gauge, RefreshCw, AlertTriangle, FileText } from "lucide-react";
import { useCapacityPlanner } from "../hooks/useCapacityPlanner";
import { useContractContext } from "../contexts/ContractContext";
import { CapacityGrid }       from "../components/CapacityGrid";
import { PageHeader }         from "../components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button }   from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminCapacidadePage() {
  const { selectedContractId, selectedContract } = useContractContext();
  const { teamCapacities, overloadedDevs, loading, selectedTeam, setSelectedTeam, reload, uniqueTeams } =
    useCapacityPlanner(selectedContractId);

  const totalDevs     = teamCapacities.reduce((s, t) => s + t.devs.length, 0);
  const totalCapHrs   = teamCapacities.reduce((s, t) => s + t.totalCapacity,  0);
  const totalAllocHrs = teamCapacities.reduce((s, t) => s + t.totalAllocated, 0);
  const globalPct     = totalCapHrs > 0 ? Math.round((totalAllocHrs / totalCapHrs) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Gauge}
        iconColor="text-emerald-400"
        description={
          loading ? "Carregando..."
          : `${totalDevs} desenvolvedor${totalDevs !== 1 ? "es" : ""} · ${totalAllocHrs}h / ${totalCapHrs}h (${globalPct}%)`
        }
        badges={[
          ...(!loading && overloadedDevs.length > 0
            ? [{ label: `${overloadedDevs.length} sobrecarregado${overloadedDevs.length !== 1 ? "s" : ""}`, icon: AlertTriangle, className: "gap-1 text-[10px] font-medium text-destructive border-destructive/50 bg-destructive/5" }]
            : []),
          ...(selectedContract ? [{ label: selectedContract.name, icon: FileText, className: "gap-1 text-[11px] font-medium text-amber-400 border-amber-400/50 bg-amber-400/5" }] : []),
        ]}
      >
        <Select value={selectedTeam} onValueChange={setSelectedTeam}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Todos os times" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos os times</SelectItem>
            {uniqueTeams.map(t => <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={reload} title="Atualizar">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </PageHeader>

      {!loading && overloadedDevs.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">Atenção: desenvolvedores sobrecarregados</p>
            <p className="text-xs text-muted-foreground mt-0.5">{overloadedDevs.map(d => d.devName).join(", ")} estão com alocação acima da capacidade declarada.</p>
          </div>
        </div>
      )}

      {loading
        ? <div className="space-y-4">{[1,2].map(i => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}</div>
        : <CapacityGrid teamCapacities={teamCapacities} />}
    </div>
  );
}
