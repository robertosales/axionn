import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useTeamsAdmin } from "../hooks/useTeamsAdmin";
import { TeamsTable } from "../components/TeamsTable";
import { TeamFormDialog } from "../components/TeamFormDialog";
import type { TeamAdmin } from "../hooks/useTeamsAdmin";

export function AdminTimesPage() {
  const { teams, loading, create, update, remove } = useTeamsAdmin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TeamAdmin | null>(null);

  const handleEdit = (team: TeamAdmin) => { setEditing(team); setDialogOpen(true); };
  const handleNew  = () => { setEditing(null); setDialogOpen(true); };
  const handleClose = () => { setDialogOpen(false); setEditing(null); };

  const handleSave = async (data: { name: string; module: string }) => {
    if (editing) return update(editing.id, data);
    return create(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Times</h2>
          <p className="text-xs text-muted-foreground">{teams.length} time{teams.length !== 1 ? "s" : ""} cadastrado{teams.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={handleNew}>
          <Plus className="h-4 w-4" /> Novo Time
        </Button>
      </div>

      {loading
        ? <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
        : <TeamsTable teams={teams} onEdit={handleEdit} onDelete={remove} />}

      <TeamFormDialog
        open={dialogOpen}
        team={editing}
        onClose={handleClose}
        onSave={handleSave}
      />
    </div>
  );
}
