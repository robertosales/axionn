import { useState, useEffect } from "react";
import { AppShell }            from "@/components/layout/AppShell";
import { useAuth }             from "@/contexts/AuthContext";
import { TeamSelectionModal }  from "@/shared/components/common/TeamSelectionModal";
import { toast }               from "sonner";
import { useRdms }             from "./hooks/useRdms";
import { RdmList }             from "./components/RdmList";
import { RdmForm }             from "./components/RdmForm";
import { RdmDetail }           from "./components/RdmDetail";
import { RdmDashboard }        from "./components/RdmDashboard";
import { RdmChecklistTemplatesPage } from "./components/RdmChecklistTemplatesPage";
import { TeamManager }         from "@/components/TeamManager";
import { TeamMembersManager }  from "@/components/TeamMembersManager";
import { UserRolesManager }    from "@/components/UserRolesManager";
import { Button }              from "@/components/ui/button";
import type { Rdm, RdmUpdate } from "./types/rdm";

export default function RdmPage() {
  const [active, setActive] = useState("dashboard");
  const { loading: authLoading, currentTeamId, setCurrentTeamId, teams } = useAuth();
  const [showTeamModal, setShowTeamModal] = useState(false);

  // RDM é transversal: aceita qualquer time do usuário (sala_agil ou sustentacao)
  const moduleTeams = teams;

  useEffect(() => {
    if (authLoading) return;
    if (!moduleTeams.length) return;
    const currentIsValid = currentTeamId && moduleTeams.some((t) => t.id === currentTeamId);
    if (currentIsValid) return;
    if (moduleTeams.length === 1) setCurrentTeamId(moduleTeams[0].id);
    else setShowTeamModal(true);
  }, [authLoading, teams]); // eslint-disable-line

  return (
    <AppShell module="rdm" activeKey={active} onNavigate={setActive}>
      {moduleTeams.length > 1 && (
        <TeamSelectionModal
          open={showTeamModal}
          teams={moduleTeams}
          moduleLabel="RDM"
          onSelect={(id) => { setCurrentTeamId(id); setShowTeamModal(false); }}
          onClose={() => setShowTeamModal(false)}
        />
      )}
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {authLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
          </div>
        ) : (
          <RdmSection active={active} setActive={setActive} />
        )}
      </div>
    </AppShell>
  );
}

function RdmSection({
  active, setActive,
}: {
  active: string;
  setActive: (v: string) => void;
}) {
  const { rdms, loading, create, update, remove, load } = useRdms();
  const { profile } = useAuth();
  const [selected, setSelected] = useState<Rdm | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async (payload: any) => {
    try {
      await create({ ...payload, criado_por: profile?.id ?? "" });
      toast.success("RDM criada com sucesso! Checklist gerado automaticamente.");
    } catch (e: any) {
      toast.error("Erro ao criar RDM: " + (e?.message ?? ""));
      throw e;
    }
  };

  const handleUpdate = async (id: string, updates: RdmUpdate) => {
    try {
      await update(id, updates);
      toast.success("RDM atualizada.");
      setSelected((prev) => (prev ? { ...prev, ...updates } : prev));
    } catch (e: any) {
      toast.error("Erro ao atualizar RDM: " + (e?.message ?? ""));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove(id);
      toast.success("RDM excluída com sucesso.");
    } catch (e: any) {
      toast.error("Erro ao excluir RDM: " + (e?.message ?? ""));
      throw e;
    }
  };

  if (selected) {
    return (
      <RdmDetail
        rdm={selected}
        onBack={() => setSelected(null)}
        onUpdate={handleUpdate}
      />
    );
  }

  switch (active) {
    case "dashboard":
      return <RdmDashboard rdms={rdms} />;

    case "rdms":
      return (
        <>
          <RdmList
            rdms={rdms}
            loading={loading}
            onNew={() => setShowForm(true)}
            onSelect={setSelected}
            onRefresh={load}
            onDelete={handleDelete}
          />
          <RdmForm
            open={showForm}
            onClose={() => setShowForm(false)}
            onSubmit={handleCreate}
          />
        </>
      );

    case "checklist":
      return <RdmChecklistTemplatesPage />;

    case "gonogo":
      return (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3">
          <p className="text-sm">
            Selecione uma RDM na aba <strong>RDMs</strong> para acessar o Go/No-Go.
          </p>
          <Button variant="outline" size="sm" onClick={() => setActive("rdms")}>
            Ir para RDMs
          </Button>
        </div>
      );

    case "times":   return <TeamManager />;
    case "membros": return <TeamMembersManager />;
    case "perfis":  return <UserRolesManager />;
    default:        return <RdmDashboard rdms={rdms} />;
  }
}
