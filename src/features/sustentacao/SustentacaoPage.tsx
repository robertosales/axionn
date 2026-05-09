import { useState, useCallback, useEffect } from "react";
import { SustentacaoBoard } from "./components/SustentacaoBoard";
import type { Demanda } from "./types/demanda";
import { useDemandas } from "./hooks/useDemandas";
import { DemandaDetail } from "./components/DemandaDetail";
import { DemandaForm } from "./components/DemandaForm";
import { SustentacaoDashboard } from "./components/SustentacaoDashboard";
import { SustentacaoWorkflow } from "./components/SustentacaoWorkflow";
import { ProjetosManager } from "./components/ProjetosManager";
import { ImportacaoView } from "./components/ImportacaoView";
import { DemandasList } from "./components/DemandasList";
import { SustentacaoRelatorios } from "./components/reports/SustentacaoRelatorios";
import { TeamManager } from "@/components/TeamManager";
import { TeamMembersManager } from "@/components/TeamMembersManager";
import { UserRolesManager } from "@/components/UserRolesManager";
import { CustomFieldManager } from "@/components/CustomFieldManager";
import { AutomationManager } from "@/components/AutomationManager";
import { DeveloperManager } from "@/components/DeveloperManager";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { TeamSelectionModal } from "@/shared/components/common/TeamSelectionModal";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function SustentacaoPage() {
  const [active, setActive] = useState("dashboard");
  const { loading: authLoading, currentTeamId, setCurrentTeamId, teams, hasPermission } = useAuth();
  const [showTeamModal, setShowTeamModal] = useState(false);

  const moduleTeams = teams.filter((t) => t.module === "sustentacao");

  useEffect(() => {
    if (authLoading || moduleTeams.length === 0) return;
    const currentIsValid = currentTeamId && moduleTeams.some((t) => t.id === currentTeamId);
    if (currentIsValid) return;
    if (moduleTeams.length === 1) {
      setCurrentTeamId(moduleTeams[0].id);
    } else {
      setShowTeamModal(true);
    }
  }, [authLoading, teams]);

  // VIEW "times" não precisa de time selecionado — não bloqueia com needsTeam
  const needsTeam = !currentTeamId && active !== "times";

  return (
    <AppShell module="sustentacao" activeKey={active} onNavigate={setActive}>
      <TeamSelectionModal
        open={showTeamModal}
        teams={moduleTeams}
        moduleLabel="Sustentação"
        onSelect={(id) => {
          setCurrentTeamId(id);
          setShowTeamModal(false);
        }}
        onClose={() => setShowTeamModal(false)}
      />

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {authLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-info" />
          </div>
        )}

        {!authLoading && needsTeam && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Building2 className="h-14 w-14 text-muted-foreground/30" />
            <p className="text-lg text-muted-foreground font-medium">Selecione ou crie um time para começar</p>
            {hasPermission("manage_teams") && (
              <Button onClick={() => setActive("times")} size="lg">
                <Building2 className="h-4 w-4 mr-2" /> Ir para Times
              </Button>
            )}
          </div>
        )}

        {/* SustentacaoSection só renderiza quando não está carregando e não é a view de times */}
        {!authLoading && !needsTeam && (
          <SustentacaoSection active={active} />
        )}
      </div>
    </AppShell>
  );
}

function SustentacaoSection({ active }: { active: string }) {
  const { demandas, loading, update, moveTo, create } = useDemandas();
  const [selected, setSelected] = useState<Demanda | null>(null);
  const [createSituacao, setCreateSituacao] = useState<string | undefined>();
  const [showCreate, setShowCreate] = useState(false);

  const handleCreateDemanda = useCallback((situacao?: string) => {
    setCreateSituacao(situacao);
    setShowCreate(true);
  }, []);

  const handleSelectDemanda = useCallback((d: Demanda) => setSelected(d), []);
  const handleUpdate = useCallback(async (id: string, updates: Partial<Demanda>) => { await update(id, updates); }, [update]);
  const handleMoveTo = useCallback(
    async (demanda: Demanda, newStatus: string, justificativa?: string) => moveTo(demanda, newStatus, justificativa),
    [moveTo],
  );

  const handleMoveDemanda = useCallback(
    async (demanda: Demanda, targetKey: string) => {
      try {
        await moveTo(demanda, targetKey);
        toast.success("Demanda movida com sucesso!");
      } catch (e: any) {
        toast.error("Erro ao mover demanda: " + (e?.message ?? ""));
      }
    },
    [moveTo],
  );

  if (selected && active === "board") {
    return (
      <DemandaDetail
        demanda={selected}
        onBack={() => setSelected(null)}
        onUpdate={handleUpdate}
        onMoveTo={handleMoveTo}
      />
    );
  }

  switch (active) {
    case "dashboard":
      return <SustentacaoDashboard />;
    case "board":
      return (
        <div className="flex flex-col h-full">
          {loading && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">Carregando demandas…</div>
          )}
          <SustentacaoBoard
            demandas={demandas}
            onCreateDemanda={handleCreateDemanda}
            onSelectDemanda={handleSelectDemanda}
            onMoveDemanda={handleMoveDemanda}
          />
          <DemandaForm
            open={showCreate}
            onClose={() => setShowCreate(false)}
            situacaoInicial={createSituacao}
            onSubmit={async (data) => {
              try {
                await create(data as Partial<Demanda>);
                toast.success("Demanda criada com sucesso!");
                setShowCreate(false);
              } catch (e: any) {
                toast.error("Erro ao criar demanda: " + (e?.message ?? ""));
              }
            }}
          />
        </div>
      );
    case "demandas":
      return <DemandasList />;
    case "projetos":
      return <ProjetosManager />;
    case "importacao":
      return <ImportacaoView />;
    case "equipe":
      return <DeveloperManager />;
    case "fluxo":
      return <SustentacaoWorkflow />;
    case "relatorios":
      return <SustentacaoRelatorios />;
    case "membros":
      return <TeamMembersManager />;
    case "perfis":
      return <UserRolesManager />;
    case "campos":
      return <CustomFieldManager />;
    case "automacoes":
      return <AutomationManager />;
    // FIX: case 'times' adicionado explicitamente para evitar queda no default
    // que retornava SustentacaoDashboard, causando o Dashboard acima do TeamManager
    case "times":
      return <TeamManager moduleFilter="sustentacao" />;
    default:
      return <SustentacaoDashboard />;
  }
}
