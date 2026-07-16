import { useState } from "react";
import { Target, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useOkr, OkrDuplicateError } from "./hooks/useOkr";
import { OkrCycleSelector } from "./components/OkrCycleSelector";
import { OkrSummaryKpis } from "./components/OkrSummaryKpis";
import { OkrObjectiveCard } from "./components/OkrObjectiveCard";
import { OkrObjectiveForm } from "./components/OkrObjectiveForm";
import type { OkrObjective } from "./types";

export function OkrPage() {
  const { teams } = useAuth();
  const { toast } = useToast();
  const { objectives, cycles, filters, setFilters, isLoading, addCheckIn, addObjective, addKeyResult, updateKeyResult, deleteKeyResult, updateObjective, deleteObjective } = useOkr();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingObjective, setEditingObjective] = useState<OkrObjective | null>(null);

  const salaAgilTeams = teams.filter((t) => t.module === "sala_agil").map((t) => ({ id: t.id, name: t.name }));

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
          <Button size="sm" className="gap-1.5 h-9" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Novo Objetivo
          </Button>
        </div>

        <OkrCycleSelector cycles={cycles} selectedCycle={filters.cycle} selectedTeam={filters.teamId} teams={salaAgilTeams} onCycleChange={(cycle) => setFilters({ cycle })} onTeamChange={(teamId) => setFilters({ teamId })} />
        <OkrSummaryKpis objectives={objectives} />

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : objectives.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center">
            <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum objetivo encontrado para este ciclo e time.</p>
            <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={() => setIsCreateOpen(true)}><Plus className="h-3.5 w-3.5" /> Criar primeiro objetivo</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {objectives.map((obj) => (
              <OkrObjectiveCard
                key={obj.id}
                objective={obj}
                onCheckIn={addCheckIn}
                onEdit={setEditingObjective}
                onDelete={handleDelete}
                onAddKeyResult={handleAddKeyResult}
                onUpdateKeyResult={handleUpdateKeyResult}
                onDeleteKeyResult={handleDeleteKeyResult}
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
