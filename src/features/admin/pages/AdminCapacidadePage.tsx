import { AlertCircle, AlertTriangle, FileText, Gauge, RefreshCw } from "lucide-react";
import { useCapacityPlanner } from "../hooks/useCapacityPlanner";
import { useContractContext } from "../contexts/ContractContext";
import { CapacityGrid } from "../components/CapacityGrid";
import { PageHeader } from "../components/PageHeader";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminCapacidadePage() {
  const { selectedContractId, selectedContract } = useContractContext();
  const {
    teamCapacities,
    overloadedDevs,
    loading,
    error,
    warnings,
    selectedTeam,
    setSelectedTeam,
    reload,
    uniqueTeams,
  } = useCapacityPlanner(selectedContractId);

  const totalDevs = teamCapacities.reduce((sum, team) => sum + team.devs.length, 0);
  const totalCapHrs = teamCapacities.reduce((sum, team) => sum + team.totalCapacity, 0);
  const totalAllocHrs = teamCapacities.reduce((sum, team) => sum + team.totalAllocated, 0);
  const globalPct = totalCapHrs > 0 ? Math.round((totalAllocHrs / totalCapHrs) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Gauge}
        iconColor="text-emerald-400"
        description={
          loading
            ? "Carregando..."
            : `${totalDevs} desenvolvedor${totalDevs !== 1 ? "es" : ""} · ${totalAllocHrs}h / ${totalCapHrs}h (${globalPct}%)`
        }
        badges={[
          ...(!loading && overloadedDevs.length > 0
            ? [{
              label: `${overloadedDevs.length} sobrecarregado${overloadedDevs.length !== 1 ? "s" : ""}`,
              icon: AlertTriangle,
              className: "gap-1 text-[10px] font-medium text-destructive border-destructive/50 bg-destructive/5",
            }]
            : []),
          ...(selectedContract
            ? [{
              label: selectedContract.name,
              icon: FileText,
              className: "gap-1 text-[11px] font-medium text-amber-400 border-amber-400/50 bg-amber-400/5",
            }]
            : []),
        ]}
      >
        <Select value={selectedTeam} onValueChange={setSelectedTeam}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Todos os times" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos os times</SelectItem>
            {uniqueTeams.map((team) => (
              <SelectItem key={team.id} value={team.id} className="text-xs">
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={reload}
          disabled={loading}
          title="Atualizar"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </PageHeader>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">Falha ao carregar a capacidade</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {warnings.map((warning) => (
        <div
          key={warning}
          className="flex items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-amber-900"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-xs">{warning}</p>
        </div>
      ))}

      {!loading && !error && uniqueTeams.length > 0 && totalDevs === 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Times encontrados, mas sem desenvolvedores cadastrados</p>
            <p className="mt-0.5 text-xs">
              A capacidade usa o cadastro operacional de Sala Ágil → Equipe. Membros com acesso ao time,
              mas sem registro em Equipe, não entram no cálculo.
            </p>
          </div>
        </div>
      )}

      {!loading && overloadedDevs.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">Atenção: desenvolvedores sobrecarregados</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {overloadedDevs.map((developer) => developer.devName).join(", ")} estão com alocação acima da capacidade declarada.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((item) => <Skeleton key={item} className="h-48 w-full rounded-lg" />)}
        </div>
      ) : error ? null : (
        <CapacityGrid teamCapacities={teamCapacities} />
      )}
    </div>
  );
}
