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
import RbacWorkspace                       from "@/features/rbac/RbacWorkspace";
import { CustomFieldManager }               from "@/components/CustomFieldManager";
import { AutomationManager }                from "@/components/AutomationManager";
import { DeveloperManager }                 from "@/components/DeveloperManager";
import { AppShell }                         from "@/components/layout/AppShell";
import { useAuth }                          from "@/contexts/AuthContext";
import { TeamSelectionModal }               from "@/shared/components/common/TeamSelectionModal";
import { supabase }                         from "@/integrations/supabase/client";
import { useQueryClient }                   from "@tanstack/react-query";
import { Building2 }                        from "lucide-react";
import { toast }                            from "sonner";
import { EmptyState }                       from "@/shared/components/common/EmptyState";
import { SkeletonList }                     from "@/shared/components/common/SkeletonList";

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

  const needsTeam = !moduleTeamId && !["times", "perfis"].includes(active);

  return (
    <AppShell module="sustentacao">
      <TeamSelectionModal
        open={showTeamModal}
        teams={moduleTeams}
        moduleLabel="Sustentação"
        onSelect={(id) => setModuleTeamId(id)}
        onClose={closeTeamModal}
      />

      <main className="mx-auto w-full max-w-[1500px] px-4 pb-8 pt-5 md:px-8 md:pt-6">
        {authLoading && (
          <div aria-busy="true" aria-label="Carregando Sustentação">
            <SkeletonList count={5} variant="card" />
          </div>
        )}

        {!authLoading && needsTeam && (
          <EmptyState
            icon={Building2}
            title="Selecione ou crie um time para começar"
            description="A Sustentação utiliza o time ativo para delimitar demandas, responsáveis e indicadores."
            actionLabel={hasPermission("manage_teams") ? "Ir para Times" : undefined}
            onAction={hasPermission("manage_teams") ? () => navigate("/sustentacao/times") : undefined}
          />
        )}

        {!authLoading && !needsTeam && (
          <SustentacaoSection key={moduleTeamId ?? "no-team"} active={active} />
        )}
      </main>
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
      } catch (error: unknown) {
        toast.error("Erro ao mover demanda: " + (error instanceof Error ? error.message : ""));
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
        <div className="flex h-full flex-col">
          {loading ? (
            <div aria-busy="true" aria-label="Carregando quadro de demandas">
              <SkeletonList count={4} variant="card" />
            </div>
          ) : (
            <SustentacaoBoard
              demandas={demandas}
              workflowColumns={workflowColumns}
              onCreateDemanda={handleCreateDemanda}
              onSelectDemanda={handleSelectDemanda}
              onMoveDemanda={handleMoveDemanda}
            />
          )}
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
    case "perfis":     return <RbacWorkspace />;
    case "campos":     return <CustomFieldManager />;
    case "automacoes": return <AutomationManager />;
    case "times":      return <TeamManager moduleFilter="sustentacao" />;
    default:           return <SustentacaoDashboard />;
  }
}
