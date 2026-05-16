import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, GitBranch, Zap, Shield } from "lucide-react";
import { useTeamsAdmin } from "../hooks/useTeamsAdmin";
import { useFluxoAdmin } from "../hooks/useFluxoAdmin";
import { FluxoTable } from "../components/FluxoTable";
import { FluxoFormDialog } from "../components/FluxoFormDialog";
import type { FluxoColuna } from "../hooks/useFluxoAdmin";

export function AdminFluxosPage() {
  const { teams, loading: loadingTeams } = useTeamsAdmin();
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const { colunas, loading, create, update, remove, moveUp, moveDown } = useFluxoAdmin(selectedTeamId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FluxoColuna | null>(null);

  const handleEdit  = (col: FluxoColuna) => { setEditing(col); setDialogOpen(true); };
  const handleNew   = () => { setEditing(null); setDialogOpen(true); };
  const handleClose = () => { setDialogOpen(false); setEditing(null); };

  const handleSave = async (data: Omit<FluxoColuna, "id" | "team_id">) => {
    if (editing) return update(editing.id, data);
    return create(data);
  };

  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            Fluxo do Kanban
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure as colunas do Kanban para cada time.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={handleNew}
          disabled={!selectedTeamId}
        >
          <Plus className="h-4 w-4" /> Nova Coluna
        </Button>
      </div>

      {/* Seletor de time */}
      <div className="max-w-xs">
        <Select
          value={selectedTeamId}
          onValueChange={setSelectedTeamId}
          disabled={loadingTeams}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Selecione um time..." />
          </SelectTrigger>
          <SelectContent>
            {teams.map(t => (
              <SelectItem key={t.id} value={t.id}>
                <span className="flex items-center gap-1.5">
                  {t.module === "sala_agil"
                    ? <Zap className="h-3 w-3 text-primary" />
                    : <Shield className="h-3 w-3 text-muted-foreground" />
                  }
                  {t.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contagem */}
      {selectedTeamId && (
        <p className="text-xs text-muted-foreground">
          {loading ? "Carregando..." : `${colunas.length} coluna${colunas.length !== 1 ? "s" : ""} configurada${colunas.length !== 1 ? "s" : ""} para ${selectedTeam?.name ?? ""}`}
        </p>
      )}

      {/* Placeholder sem time selecionado */}
      {!selectedTeamId && !loadingTeams && (
        <div className="border border-dashed rounded-lg p-10 text-center">
          <GitBranch className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Selecione um time para visualizar e configurar seu fluxo.</p>
        </div>
      )}

      {/* Tabela */}
      {selectedTeamId && !loading && (
        <FluxoTable
          colunas={colunas}
          onEdit={handleEdit}
          onDelete={remove}
          onMoveUp={moveUp}
          onMoveDown={moveDown}
        />
      )}

      {selectedTeamId && loading && (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando colunas...</p>
      )}

      <FluxoFormDialog
        open={dialogOpen}
        coluna={editing}
        onClose={handleClose}
        onSave={handleSave}
      />
    </div>
  );
}
