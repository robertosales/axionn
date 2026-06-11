import { useState } from "react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useUsersAdmin } from "../hooks/useUsersAdmin";
import { useTeamsAdmin } from "../hooks/useTeamsAdmin";
import { UserFormDialog } from "../components/UserFormDialog";
import { UserRolesManager } from "@/components/UserRolesManager";
import { supabase } from "@/integrations/supabase/client";

export function AdminUsuariosPage() {
  const { createUser } = useUsersAdmin();
  const { teams } = useTeamsAdmin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);

  // Verifica se quem está logado é admin_master para controlar visibilidade
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle()
        .then(({ data }) => setIsCurrentUserAdmin(!!data));
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Usuários</h2>
          <p className="text-xs text-muted-foreground">Gerencie usuários, perfis RBAC e módulos de acesso</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Novo Usuário
        </Button>
      </div>

      <UserRolesManager />

      <UserFormDialog
        open={dialogOpen}
        user={null}
        teams={teams}
        isCurrentUserAdmin={isCurrentUserAdmin}
        onClose={() => setDialogOpen(false)}
        onCreate={createUser}
        onUpdate={async () => false}
      />
    </div>
  );
}
