import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { useUsersAdmin } from "../hooks/useUsersAdmin";
import { useTeamsAdmin } from "../hooks/useTeamsAdmin";
import { UsersTable } from "../components/UsersTable";
import { UserFormDialog } from "../components/UserFormDialog";
import type { UserAdmin } from "../hooks/useUsersAdmin";

export function AdminUsuariosPage() {
  const { users, loading, update, toggleAdmin, toggleActive, resetPassword, createUser } = useUsersAdmin();
  const { teams } = useTeamsAdmin();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserAdmin | null>(null);

  const handleEdit  = (u: UserAdmin) => { setEditing(u); setDialogOpen(true); };
  const handleNew   = () => { setEditing(null); setDialogOpen(true); };
  const handleClose = () => { setDialogOpen(false); setEditing(null); };

  const filtered = users.filter(u =>
    u.display_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.team_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Usuários</h2>
          <p className="text-xs text-muted-foreground">{users.length} usuário{users.length !== 1 ? "s" : ""} no sistema</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={handleNew}>
          <Plus className="h-4 w-4" /> Novo Usuário
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, e-mail ou time..."
          className="pl-8 h-9 text-sm"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading
        ? <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
        : <UsersTable
            users={filtered}
            onEdit={handleEdit}
            onToggleAdmin={toggleAdmin}
            onToggleActive={toggleActive}
            onResetPassword={resetPassword}
          />}

      <UserFormDialog
        open={dialogOpen}
        user={editing}
        teams={teams}
        onClose={handleClose}
        onCreate={createUser}
        onUpdate={(userId, data) => update(userId, data)}
      />
    </div>
  );
}
