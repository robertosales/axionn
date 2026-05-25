import React, { useEffect, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { TeamSelectionModal } from "@/shared/components/common/TeamSelectionModal";
import { useSprint } from "@/contexts/SprintContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Building2, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

// ─── Componentes leves — importados estaticamente ─────────────────────────────
import { SprintManager }     from "@/components/SprintManager";
import { DeveloperManager }  from "@/components/DeveloperManager";
import { KanbanBoard }       from "@/components/KanbanBoard";
import { DashboardHome }     from "@/components/DashboardHome";

// ─── Componentes pesados — lazy loaded (só baixados quando a rota é acessada) ──
// AgileHistory   ~43.5 KB  — histórico de sprints, acesso ocasional
// UserRolesManager ~48.6 KB — gestão de perfis, acesso restrito/admin
// PlanningPoker  ~43.9 KB  — sessões de poker, carregado por rota dedicada
//                            mas importado aqui p/ seção interna também
// Os demais têm 15–35 KB e beneficiam do lazy quando há muitas seções ativas
const AgileHistory        = lazy(() => import("@/components/AgileHistory").then((m) => ({ default: m.AgileHistory })));
const UserRolesManager    = lazy(() => import("@/components/UserRolesManager").then((m) => ({ default: m.UserRolesManager })));
const PlanningPoker       = lazy(() => import("@/components/PlanningPoker").then((m) => ({ default: m.PlanningPoker })));
const UserStoryManager    = lazy(() => import("@/components/UserStoryManager").then((m) => ({ default: m.UserStoryManager })));
const ActivityManager     = lazy(() => import("@/components/ActivityManager").then((m) => ({ default: m.ActivityManager })));
const MetricsDashboard    = lazy(() => import("@/components/MetricsDashboard").then((m) => ({ default: m.MetricsDashboard })));
const ImpedimentList      = lazy(() => import("@/components/ImpedimentManager").then((m) => ({ default: m.ImpedimentList })));
const EpicManager         = lazy(() => import("@/components/EpicManager").then((m) => ({ default: m.EpicManager })));
const WorkflowManager     = lazy(() => import("@/components/WorkflowManager").then((m) => ({ default: m.WorkflowManager })));
const CustomFieldManager  = lazy(() => import("@/components/CustomFieldManager").then((m) => ({ default: m.CustomFieldManager })));
const AutomationManager   = lazy(() => import("@/components/AutomationManager").then((m) => ({ default: m.AutomationManager })));
const TeamManager         = lazy(() => import("@/components/TeamManager").then((m) => ({ default: m.TeamManager })));
const TeamMembersManager  = lazy(() => import("@/components/TeamMembersManager").then((m) => ({ default: m.TeamMembersManager })));
const CalendarView        = lazy(() => import("@/components/CalendarView").then((m) => ({ default: m.CalendarView })));
const RetroManager        = lazy(() => import("@/components/RetroManager").then((m) => ({ default: m.RetroManager })));
const ApfGeneratorPage    = lazy(() => import("@/features/apf/components/ApfGeneratorPage").then((m) => ({ default: m.ApfGeneratorPage })));

// ─── Fallback de seção ────────────────────────────────────────────────────────
function SectionLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

const VALID_SECTIONS = [
  "dashboard",
  "backlog",
  "board",
  "planning-poker",
  "retrospectiva",
  "releases",
  "relatorios",
  "notificacoes",
  "gerador-apf",
  "metricas",
  "historico",
  "calendario",
  "equipe",
  "epicos",
  "atividades",
  "impedimentos",
  "times",
  "membros",
  "perfis",
  "fluxo",
  "campos",
  "automacoes",
] as const;

export type SectionKey = (typeof VALID_SECTIONS)[number];

const TEAM_FREE_SECTIONS: SectionKey[] = [
  "planning-poker",
  "retrospectiva",
  "times",
  "membros",
  "perfis",
  "fluxo",
  "campos",
  "automacoes",
];

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-3">
      <ShieldAlert className="h-14 w-14 text-destructive/40" />
      <p className="text-lg font-semibold text-foreground">Acesso Restrito</p>
      <p className="text-sm text-muted-foreground">Você não tem permissão para acessar esta seção.</p>
    </div>
  );
}

function SectionGuard({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { hasPermission } = useAuth();
  return hasPermission(permission) ? <>{children}</> : <AccessDenied />;
}

const Index = () => {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();

  const active = (VALID_SECTIONS.includes(section as SectionKey) ? section : "dashboard") as SectionKey;

  const { loading, currentTeamId, setCurrentTeamId, teams, hasPermission, isAdmin } = useAuth();
  const { activeSprint } = useSprint();
  const [showTeamModal, setShowTeamModal] = React.useState(false);
  const moduleTeams = teams.filter((t) => t.module === "sala_agil");

  useEffect(() => {
    if (loading || moduleTeams.length === 0) return;
    const currentIsValid = currentTeamId && moduleTeams.some((t) => t.id === currentTeamId);
    if (currentIsValid) return;
    if (moduleTeams.length === 1) {
      setCurrentTeamId(moduleTeams[0].id);
    } else {
      setShowTeamModal(true);
    }
  }, [loading, teams, currentTeamId]); // eslint-disable-line

  useEffect(() => {
    if (loading) return;
    if (section && !VALID_SECTIONS.includes(section as SectionKey)) {
      navigate("/sala-agil/dashboard", { replace: true });
    }
  }, [loading, section]);

  const handleNavigate = (key: string) => navigate(`/sala-agil/${key}`);

  const isTeamFreeSection = TEAM_FREE_SECTIONS.includes(active);
  const needsTeam = !loading && !isAdmin && !currentTeamId && !isTeamFreeSection;

  // teamKey força remontagem de todos os componentes ao trocar de time,
  // zerando states internos (filtros, sessionStorage, paginação, etc.)
  const teamKey = currentTeamId ?? "no-team";

  return (
    <AppShell module="sala_agil" activeKey={active} onNavigate={handleNavigate}>
      <TeamSelectionModal
        open={showTeamModal}
        teams={moduleTeams}
        moduleLabel="Sala Ágil"
        onSelect={(id) => {
          setCurrentTeamId(id);
          setShowTeamModal(false);
        }}
        onClose={() => setShowTeamModal(false)}
      />

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-success" />
          </div>
        )}

        {!loading && needsTeam && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Building2 className="h-14 w-14 text-muted-foreground/30" />
            <p className="text-lg text-muted-foreground font-medium">Selecione ou crie um time para começar</p>
            {hasPermission("manage_teams") && (
              <Button onClick={() => handleNavigate("times")} size="lg">
                <Building2 className="h-4 w-4 mr-2" /> Ir para Times
              </Button>
            )}
          </div>
        )}

        {!loading && !needsTeam && (
          // key={teamKey} garante remontagem completa de todos os filhos
          // quando o time muda, zerando states internos de cada componente
          <div key={teamKey}>
            {/* Seções leves — sem Suspense adicional */}
            {active === "dashboard" && <DashboardHome key={`dash-${currentTeamId}-${activeSprint?.id ?? "none"}`} />}
            {active === "equipe"    && <DeveloperManager />}
            {active === "board"     && (
              <SectionGuard permission="view_kanban">
                <KanbanBoard />
              </SectionGuard>
            )}

            {/* Seções pesadas — cada uma com seu próprio Suspense boundary */}
            <Suspense fallback={<SectionLoader />}>
              {active === "planning-poker" && <PlanningPoker />}
              {active === "calendario"     && <CalendarView />}
              {active === "retrospectiva"  && <RetroManager />}

              {active === "gerador-apf" && (
                <SectionGuard permission="view_backlog">
                  <ApfGeneratorPage />
                </SectionGuard>
              )}

              {active === "backlog" && (
                <SectionGuard permission="view_backlog">
                  <div className="space-y-8">
                    <SprintManager />
                    <UserStoryManager />
                  </div>
                </SectionGuard>
              )}

              {active === "epicos" && (
                <SectionGuard permission="view_backlog">
                  <EpicManager />
                </SectionGuard>
              )}

              {active === "atividades" && (
                <SectionGuard permission="manage_activities">
                  <ActivityManager />
                </SectionGuard>
              )}

              {active === "impedimentos" && (
                <SectionGuard permission="report_impediment">
                  <ImpedimentList />
                </SectionGuard>
              )}

              {active === "metricas" && (
                <SectionGuard permission="view_dashboard">
                  <MetricsDashboard />
                </SectionGuard>
              )}

              {/* AgileHistory — 43.5KB, carregado só na rota historico */}
              {active === "historico" && (
                <SectionGuard permission="view_dashboard">
                  <AgileHistory />
                </SectionGuard>
              )}

              {active === "times" && (
                <SectionGuard permission="manage_teams">
                  <TeamManager moduleFilter="sala_agil" />
                </SectionGuard>
              )}

              {active === "membros" && (
                <SectionGuard permission="manage_users">
                  <TeamMembersManager />
                </SectionGuard>
              )}

              {/* UserRolesManager — 48.6KB, carregado só na rota perfis */}
              {active === "perfis" && (
                <SectionGuard permission="manage_roles">
                  <UserRolesManager />
                </SectionGuard>
              )}

              {active === "fluxo" && (
                <SectionGuard permission="manage_workflow">
                  <WorkflowManager />
                </SectionGuard>
              )}

              {active === "campos" && (
                <SectionGuard permission="manage_custom_fields">
                  <CustomFieldManager />
                </SectionGuard>
              )}

              {active === "automacoes" && (
                <SectionGuard permission="manage_automations">
                  <AutomationManager />
                </SectionGuard>
              )}
            </Suspense>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Index;
