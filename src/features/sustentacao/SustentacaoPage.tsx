/**
 * SustentacaoPage — fix(sustentacao/team-scope)
 *
 * Fase 5d: remove aba Projetos da Sustentação.
 * Gestão de projetos foi centralizada no painel Admin (fase 5c).
 */
import { useState, useCallback, useEffect }   from "react";
import { useLocation, useNavigate }            from "react-router-dom";
import { SustentacaoBoard }                   from "./components/SustentacaoBoard";
import type { Demanda }                        from "./types/demanda";
import { useDemandas }                         from "./hooks/useDemandas";
import { useWorkflowSteps }                   from "./hooks/useWorkflowSteps";
import { useModuleTeam }                      from "./hooks/useModuleTeam";
import { DemandaDetail }                      from "./components/DemandaDetail";
import { DemandaForm }                        from "./components/DemandaForm";
import { SustentacaoDashboard }               from "./components/SustentacaoDashboard";
import { SustentacaoWorkflow }                from "./components/SustentacaoWorkflow";
import { ImportacaoView }                     from "./components/ImportacaoView";
import { DemandasList }                      from "./components/DemandasList";
import { SustentacaoRelatorios }             from "./components/reports/SustentacaoRelatorios";
import { TeamManager }                       from "@/components/TeamManager";
import { TeamMembersManager }               from "@/components/TeamMembersManager";
import { UserRolesManager }                 from "@/components/UserRolesManager";
import { CustomFieldManager }               from "@/components/CustomFieldManager";
import { AutomationManager }                from "@/components/AutomationManager";
import { DeveloperManager }                 from "@/components/DeveloperManager";
import { AppShell }                         from "@/components/layout/AppShell";
import { useAuth }                          from "@/contexts/AuthContext";
import { TeamSelectionModal }               from "@/shared/components/common/TeamSelectionModal";
import { supabase }                         from "@/integrations/supabase/client";
import { useQueryClient }                   from "@tanstack/react-query";
import { Building2 }                        from "lucide-react";
import { Button }                           from "@/components/ui/button";
import { toast }                            from "sonner";

export default function SustentacaoPage() {
  const { pathname }              = useLocation();
  const navigate                  = useNavigate();
  const active                    = pathname.split("/")[2] || "dashboard";
  const { loading: authLoading, hasPermission } = useAuth();
  const qc                        = useQueryClient();

  const {
    moduleTeamId,
    moduleTeams,
    showTeamModal,
    setModuleTeamId,
    closeTeamModal,
  } = useModuleTeam("sustentacao");

  // Canal RT singleton para workflow-steps
  useEffect(() => {
    const sub = supabase
      .channel("workflow-steps-rt")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "sustentacao_workflow_steps" },
        () => qc.invalidateQueries({ queryKey: ["workflow-steps"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [qc]);

  const needsTeam = !moduleTeamId && active !== "times";

  return (
    <AppShell module="sustentacao" activeKey={active}>
      <TeamSelectionModal
        open={showTeamModal}
        teams={moduleTeams}
        moduleLabel="Sustentação"
        onSelect={(id) => setModuleTeamId(id)}
        onClose={closeTeamModal}
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
            <p className="text-lg text-muted-foreground font-medium">
              Selecione ou crie um time para começar
            </p>
            {hasPermission("manage_teams") && (
              <Button onClick={() => navigate("/sustentacao/times")} size="lg">
                <Building2 className="h-4 w-4 mr-2" /> Ir para Times
              </Button>
            )}
          </div>
        )}

        {!authLoading && !needsTeam && (
          <SustentacaoSection active={active} />
        )}
      </div>
    </AppShell>
  );
}

function SustentacaoSection({ active }: { active: string }) {
  const { demandas, loading, update, moveTo, create } = useDemandas();
  const workflowSteps                                 = useWorkflowSteps();

  const [selected,       setSelected]       = useState<Demanda | null>(null);
  const [createSituacao, setCreateSituacao] = useState<string | undefined>();
  const [showCreate,     setShowCreate]     = useState(false);

  useEffect(() => {
    if (active !== "board") setSelected(null);
  }, [active]);

  const handleCreateDemanda = useCallback((situacao?: string) => {
    setCreateSituacao(situacao);
    setShowCreate(true);
  }, []);

  const handleSelectDemanda = useCallback((d: Demanda) => setSelected(d), []);

  const handleUpdate = useCallback(
    async (id: string, updates: Partial<Demanda>) => { await update(id, updates); },
    [update],
  );

  const handleMoveTo = useCallback(
    async (demanda: Demanda, newStatus: string, justificativa?: string) =>
      moveTo(demanda, newStatus, justificativa),
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

  const workflowColumns = workflowSteps.map((s) => ({
    key:        s.key,
    label:      s.label,
    color:      s.hex,
    sort_order: s.order,
  }));

  switch (active) {
    case "dashboard":  return <SustentacaoDashboard />;
    case "board":
      return (
        <div className="flex flex-col h-full">
          {loading && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Carregando demandas…
            </div>
          )}
          <SustentacaoBoard
            demandas={demandas}
            workflowColumns={workflowColumns}
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
                setShowCreate(false);
              } catch {
                // Toast já exibido por useDemandaMutations.create — manter modal aberto
              }
            }}
          />
        </div>
      );
    case "demandas":   return <DemandasList />;
    case "importacao": return <ImportacaoView />;
    case "equipe":     return <DeveloperManager />;
    case "fluxo":      return <SustentacaoWorkflow />;
    case "relatorios": return <SustentacaoRelatorios />;
    case "membros":    return <TeamMembersManager />;
    case "perfis":     return <UserRolesManager />;
    case "campos":     return <CustomFieldManager />;
    case "automacoes": return <AutomationManager />;
    case "times":      return <TeamManager moduleFilter="sustentacao" />;
    default:           return <SustentacaoDashboard />;
  }
}
