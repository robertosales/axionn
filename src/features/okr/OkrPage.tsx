import { useMemo, useState } from "react";
import { Target, Plus, RefreshCw, Lock, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useOkr, OkrDuplicateError } from "./hooks/useOkr";
import { exportOkrsToCSV, exportOkrsToPDF } from "./utils/okrExport";
import { OkrCycleSelector } from "./components/OkrCycleSelector";
import { OkrSummaryKpis } from "./components/OkrSummaryKpis";
import { OkrObjectiveCard } from "./components/OkrObjectiveCard";
import { OkrObjectiveForm } from "./components/OkrObjectiveForm";
import type { OkrObjective } from "./types";

export function OkrPage() {
  const { teams } = useAuth();
  const { toast } = useToast();
  const { objectives, cycles, filters, setFilters, isLoading, isError,
    // Entitlements flags
    canView, canCreate, canEdit, canArchive, canCheckIn, canInitiatives,
    canAutoMetrics, canHistory, canExport, canAiRecommendations,
    // Actions
    addCheckIn, refreshKeyResult, addObjective, addKeyResult, updateKeyResult, deleteKeyResult, updateObjective, deleteObjective } = useOkr();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingObjective, setEditingObjective] = useState<OkrObjective | null>(null);
  const [healthFilter, setHealthFilter] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  const salaAgilTeams = teams.filter((t) => t.module === "sala_agil").map((t) => ({ id: t.id, name: t.name }));
  const owners = useMemo(() => [...new Map(objectives.filter((objective) => objective.owner_id).map((objective) => [objective.owner_id, objective.owner_name || objective.owner_id])).entries()], [objectives]);
  const visibleObjectives = useMemo(() => objectives.filter((objective) => {
    const health = objective.calculated_health ?? objective.status;
    const healthMatches = healthFilter === "all"
      || healthFilter === "measured" && objective.calculated_progress != null
      || healthFilter === "at_risk" && ["attention", "at_risk", "off_track"].includes(health)
      || health === healthFilter;
    return healthMatches
      && (lifecycleFilter === "all" || objective.lifecycle_status === lifecycleFilter)
      && (ownerFilter === "all" || objective.owner_id === ownerFilter);
  }), [objectives, healthFilter, lifecycleFilter, ownerFilter]);

  const handleCreateSubmit = async (payload: Parameters<typeof addObjective>[0]) => {
    try {
      await addObjective(payload);
      setIsCreateOpen(false);
      toast({ title: "Objetivo criado com sucesso!", variant: "default" });
    } catch (err: any) {
      if (err instanceof OkrDuplicateError) {
        toast({ title: "Objetivo duplicado", description: "Já existe um objetivo com este título para este time e ciclo.", variant: "destructive" });
      } else {
        toast({ title: "Erro ao criar objetivo", description: err?.message ?? "Tente novamente.", variant: "destructive" });
      }
    }
  };

  const handleEditSubmit = async (payload: Parameters<typeof addObjective>[0]) => {
    if (!editingObjective) return;
    try {
      await updateObjective(editingObjective.id, payload);
      setEditingObjective(null);
      toast({ title: "Objetivo atualizado com sucesso!", variant: "default" });
    } catch (err: any) {
      if (err instanceof OkrDuplicateError) {
        toast({ title: "Objetivo duplicado", description: "Já existe outro objetivo com este título para este time e ciclo.", variant: "destructive" });
      } else {
        toast({ title: "Erro ao atualizar objetivo", description: err?.message ?? "Tente novamente.", variant: "destructive" });
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteObjective(id);
      toast({ title: "Objetivo excluído com sucesso!", variant: "default" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir objetivo", description: err?.message ?? "Tente novamente.", variant: "destructive" });
    }
  };

  const handleAddKeyResult = async (kr: Parameters<typeof addKeyResult>[0]) => {
    try {
      await addKeyResult(kr);
      toast({ title: "Key Result adicionado!", variant: "default" });
    } catch (err: any) {
      toast({ title: "Erro ao adicionar Key Result", description: err?.message ?? "Tente novamente.", variant: "destructive" });
    }
  };

  const handleUpdateKeyResult = async (id: string, payload: Parameters<typeof updateKeyResult>[1]) => {
    try {
      await updateKeyResult(id, payload);
      toast({ title: "Key Result atualizado!", variant: "default" });
    } catch (err: any) {
      toast({ title: "Erro ao atualizar Key Result", description: err?.message ?? "Tente novamente.", variant: "destructive" });
    }
  };

  const handleDeleteKeyResult = async (id: string) => {
    try {
      await deleteKeyResult(id);
      toast({ title: "Key Result excluído!", variant: "default" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir Key Result", description: err?.message ?? "Tente novamente.", variant: "destructive" });
    }
  };

  const handleRefreshAll = async () => {
    const automaticKrs = visibleObjectives.flatMap((objective) => objective.key_results).filter((kr) => kr.update_type === "automatic" || kr.update_type === "hybrid");
    if (!automaticKrs.length) {
      toast({ title: "Nenhuma medição automática", description: "Os objetivos visíveis não possuem KRs automáticos ou híbridos." });
      return;
    }
    setIsRefreshingAll(true);
    try {
      const results = await Promise.allSettled(automaticKrs.map((kr) => refreshKeyResult(kr.id)));
      const failures = results.filter((result) => result.status === "rejected").length;
      toast({ title: `${automaticKrs.length - failures} medição(ões) atualizada(s)`, description: failures ? `${failures} medição(ões) não puderam ser atualizadas.` : "Todos os KRs automáticos visíveis foram recalculados.", variant: failures ? "destructive" : "default" });
    } finally {
      setIsRefreshingAll(false);
    }
  };

  if (!canView) {
    return (
      <AppShell module="sala_agil">
        <div className="p-6 max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">OKR</h1>
              <p className="text-sm text-muted-foreground">Objetivos e Key Results · {filters.cycle}</p>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-12 text-center">
            <Lock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Acesso negado</p>
            <p className="text-sm text-muted-foreground mt-1">Seu plano atual não inclui acesso ao módulo OKR.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell module="sala_agil">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">OKR</h1>
              <p className="text-sm text-muted-foreground">Objetivos e Key Results · {filters.cycle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canExport && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-9 gap-1.5"><Download className="h-4 w-4" /> Exportar</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportOkrsToCSV(objectives, filters.cycle)}>CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportOkrsToPDF(objectives, filters.cycle)}>PDF</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={handleRefreshAll} disabled={isRefreshingAll || !canAutoMetrics}>
              <RefreshCw className={`h-4 w-4 ${isRefreshingAll ? "animate-spin" : ""}`} /> Atualizar medições
              {!canAutoMetrics && <Lock className="h-3 w-3 ml-1" />}
            </Button>
            {canCreate && (
              <Button size="sm" className="gap-1.5 h-9" onClick={() => setIsCreateOpen(true)}><Plus className="h-4 w-4" /> Novo Objetivo</Button>
            )}
            {!canCreate && (
              <Button size="sm" variant="outline" className="h-9 gap-1.5" disabled>
                <Plus className="h-4 w-4" /> Novo Objetivo
                <Lock className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>

        <OkrCycleSelector cycles={cycles} selectedCycle={filters.cycle} selectedTeam={filters.teamId} teams={salaAgilTeams} onCycleChange={(cycle) => setFilters({ cycle })} onTeamChange={(teamId) => setFilters({ teamId })} />
        <OkrSummaryKpis objectives={objectives} activeFilter={healthFilter} onFilterChange={setHealthFilter} />
        <div className="flex flex-wrap gap-2">
          <select value={lifecycleFilter} onChange={(e) => setLifecycleFilter(e.target.value)} className="h-8 rounded-lg border bg-background px-3 text-xs"><option value="all">Todos os status</option><option value="draft">Rascunho</option><option value="active">Ativo</option><option value="completed">Concluído</option><option value="archived">Arquivado</option></select>
          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="h-8 rounded-lg border bg-background px-3 text-xs"><option value="all">Todos os responsáveis</option>{owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          {(healthFilter !== "all" || lifecycleFilter !== "all" || ownerFilter !== "all") && <Button variant="ghost" size="sm" onClick={() => { setHealthFilter("all"); setLifecycleFilter("all"); setOwnerFilter("all"); }}>Limpar filtros</Button>}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : isError ? (
          <div className="rounded-xl border bg-destructive/10 p-6 text-center text-destructive">
            <p className="font-medium">Erro ao carregar objetivos.</p>
          </div>
        ) : objectives.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center">
            <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum objetivo encontrado para este ciclo e time.</p>
            {canCreate && (
              <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={() => setIsCreateOpen(true)}><Plus className="h-3.5 w-3.5" /> Criar primeiro objetivo</Button>
            )}
            {!canCreate && (
              <p className="text-sm text-muted-foreground mt-4">Seu plano não permite criar objetivos.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {visibleObjectives.map((obj) => (
              <OkrObjectiveCard
                key={obj.id}
                objective={obj}
                onCheckIn={canCheckIn ? addCheckIn : undefined}
                onRefreshKeyResult={canAutoMetrics ? async (krId) => {
                  try { await refreshKeyResult(krId); toast({ title: "Medição atualizada" }); }
                  catch (error: any) { toast({ title: "Erro ao atualizar medição", description: error?.message, variant: "destructive" }); }
                } : undefined}
                onEdit={canEdit ? setEditingObjective : undefined}
                onDelete={canArchive ? handleDelete : undefined}
                onAddKeyResult={canCreate ? handleAddKeyResult : undefined}
                onUpdateKeyResult={canEdit ? handleUpdateKeyResult : undefined}
                onDeleteKeyResult={canEdit ? handleDeleteKeyResult : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <OkrObjectiveForm open={isCreateOpen} onClose={() => setIsCreateOpen(false)} teams={salaAgilTeams} defaultCycle={filters.cycle} onSubmit={handleCreateSubmit} />
      <OkrObjectiveForm open={!!editingObjective} onClose={() => setEditingObjective(null)} teams={salaAgilTeams} defaultCycle={filters.cycle} objective={editingObjective} onSubmit={handleEditSubmit} />
    </AppShell>
  );
}
