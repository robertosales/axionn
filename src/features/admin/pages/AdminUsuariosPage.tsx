import { useState, useEffect } from "react";
import { Plus, Users, FileText } from "lucide-react";
import { useUsersAdmin }     from "../hooks/useUsersAdmin";
import { useTeamsAdmin }     from "../hooks/useTeamsAdmin";
import { useContractContext } from "../contexts/ContractContext";
import { UserFormDialog }    from "../components/UserFormDialog";
import { UserRolesManager }  from "@/components/UserRolesManager";
import { PageHeader }        from "../components/PageHeader";
import { supabase }          from "@/integrations/supabase/client";
import { useNavigate }       from "react-router-dom";
import { useOrganization }   from "@/contexts/OrganizationContext";
import { ORGANIZATION_TENANCY_ENABLED } from "@/lib/featureFlags";

export function AdminUsuariosPage() {
  const navigate = useNavigate();
  const { currentOrganizationId } = useOrganization();
  const { selectedContractId, selectedContract } = useContractContext();
  const { createUser }   = useUsersAdmin(selectedContractId);
  const { teams }        = useTeamsAdmin(selectedContractId);
  const [dialogOpen,         setDialogOpen]         = useState(false);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsCurrentUserAdmin(!!data);
    });
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Users}
        iconColor="text-teal-400"
        description={selectedContract ? "Usuários cadastrados no contrato" : "Todos os usuários cadastrados"}
        badges={selectedContract ? [{ label: selectedContract.name, icon: FileText, className: "gap-1 text-[11px] font-medium text-amber-400 border-amber-400/50 bg-amber-400/5" }] : []}
        actions={[{
          label: ORGANIZATION_TENANCY_ENABLED && currentOrganizationId
            ? "Convidar Usuário"
            : "Novo Usuário",
          icon: Plus,
          onClick: () => {
            if (ORGANIZATION_TENANCY_ENABLED && currentOrganizationId) {
              navigate("/organization/members");
              return;
            }
            setDialogOpen(true);
          },
        }]}
      />
      <UserRolesManager />
      {(!ORGANIZATION_TENANCY_ENABLED || !currentOrganizationId) && (
        <UserFormDialog
          open={dialogOpen} user={null} teams={teams}
          isCurrentUserAdmin={isCurrentUserAdmin}
          onClose={() => setDialogOpen(false)}
          onCreate={createUser} onUpdate={async () => false}
        />
      )}
    </div>
  );
}
