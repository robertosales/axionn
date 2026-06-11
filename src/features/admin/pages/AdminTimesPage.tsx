import { useState } from "react";
import { Plus, UsersRound, FileText } from "lucide-react";
import { Skeleton }           from "@/components/ui/skeleton";
import { useTeamsAdmin, type TeamAdmin } from "../hooks/useTeamsAdmin";
import { useContractContext } from "../contexts/ContractContext";
import { TeamsTable }         from "../components/TeamsTable";
import { TeamFormDialog }     from "../components/TeamFormDialog";
import { PageHeader }         from "../components/PageHeader";

export function AdminTimesPage() {
  const { selectedContractId, selectedContract } = useContractContext();
  const { teams, loading, create, update, remove } = useTeamsAdmin(selectedContractId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing,    setEditing]    = useState<TeamAdmin | null>(null);

  const handleSave = async (data: { name: string; module: string }) =>
    editing ? update(editing.id, data) : create(data);

  const openNew  = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (team: TeamAdmin) => { setEditing(team); setDialogOpen(true); };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={UsersRound}
        iconColor="text-blue-400"
        description={
          loading ? "Carregando..."
          : `${teams.length} time${teams.length !== 1 ? "s" : ""} cadastrado${teams.length !== 1 ? "s" : ""}`
        }
        badges={selectedContract ? [{ label: selectedContract.name, icon: FileText, className: "gap-1 text-[11px] font-medium text-amber-400 border-amber-400/50 bg-amber-400/5" }] : []}
        actions={[{ label: "Novo Time", icon: Plus, onClick: openNew }]}
      />
      {loading
        ? <Skeleton className="h-64 w-full rounded-xl" />
        : <TeamsTable teams={teams} onEdit={openEdit} onDelete={remove} />}
      <TeamFormDialog
        open={dialogOpen} team={editing}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSave={handleSave}
      />
    </div>
  );
}
