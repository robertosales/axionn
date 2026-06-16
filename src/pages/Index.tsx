import React, { useEffect, lazy, Suspense, useTransition } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { TeamSelectionModal } from "@/shared/components/common/TeamSelectionModal";
import { useSprint } from "@/contexts/SprintContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Building2, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

// ─── Componentes leves — importados estaticamente─────────────────────────────
import { SprintManager } from "@/components/SprintManager";
import { DeveloperManager } from "@/components/DeveloperManager";
import { KanbanBoard } from "@/components/KanbanBoard";
import { DashboardHome } from "@/components/DashboardHome";
import { DemandasPorTimeSection } from "@/features/contracts/DemandasPorTimeSection";

// ─── Componentes pesados — lazy loaded ───────────────────────────────────────
const AgileHistory = lazy(() => import("@/components/AgileHistory").then((m) => ({ default: m.AgileHistory })));
const UserRolesManager = lazy(() =>
  import("@/components/UserRolesManager").then((m) => ({ default: m.UserRolesManager })),
);
const PlanningPoker = lazy(() => import("@/components/PlanningPoker").then((m) => ({ default: m.PlanningPoker })));
const UserStoryManager = lazy(() =>
  import("@/components/UserStoryManager").then((m) => ({ default: m.UserStoryManager })),
);
const ActivityManager = lazy(() =>
  import("@/components/ActivityManager").then((m) => ({ default: m.ActivityManager })),
);
const MetricsDashboard = lazy(() =>
  import("@/components/MetricsDashboard").then((m) => ({ default: m.MetricsDashboard })),
);
const ImpedimentList = lazy(() =>
  import("@/components/ImpedimentManager").then((m) => ({ default: m.ImpedimentList })),
);
const EpicManager = lazy(() => import("@/components/EpicManager").then((m) => ({ default: m.EpicManager })));
const WorkflowManager = lazy(() =>
  import("@/components/WorkflowManager").then((m) => ({ default: m.WorkflowManager })),
);
const CustomFieldManager = lazy(() =>
  import("@/components/CustomFieldManager").then((m) => ({ default: m.CustomFieldManager })),
);
const AutomationManager = lazy(() =>
  import("@/components/AutomationManager").then((m) => ({ default: m.AutomationManager })),
);
const TeamManager = lazy(() => import("@/components/TeamManager").then((m) => ({ default: m.TeamManager })));
const TeamMembersManager = lazy(() =>
  import("@/components/TeamMembersManager").then((m) => ({ default: m.TeamMembersManager })),
);
const CalendarView = lazy(() => import("@/components/CalendarView").then((m) => ({ default: m.CalendarView })));
const RetroManager = lazy(() => import("@/components/RetroManager").then((m) => ({ default: m.RetroManager })));
const ApfGeneratorPage = lazy(() =>
  import("@/features/apf/components/ApfGeneratorPage").then((m) => ({ default: m.ApfGeneratorPage })),
);
const SalaAgilReportsPage = lazy(() =>
  import("@/features/reports/pages/SalaAgilReportsPage").then((m) => ({ default: m.SalaAgilReportsPage })),
);

// ─── Skeleton de seção ────────────────────────────────────────────────────────
function SectionSkeleton() {
  return (
    <div className="space-y-4 p-2" aria-busy="true" aria-label="Carregando seção…">
      <div className="h-7 w-48 rounded-md bg-muted animate-pulse" />
      <div className="flex gap-3">
        <div className="h-9 w-32 rounded-md bg-muted animate-pulse" />
        <div className="h-9 w-24 rounded-md bg-muted animate-pulse" />
        <div className="ml-auto h-9 w-28 rounded-md bg-muted animate-pulse" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 w-full rounded-lg bg-muted animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

function SectionLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

class SectionErrorBoundary extends React.Component<{ name: string; children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { name: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.error(`[SectionErrorBoundary] Erro na seção "${this.props.name}":`, err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 text-center">
          <ShieldAlert className="h-12 w-12 text-destructive/40" />
          <p className="text-base font-medium text-foreground">Erro ao carregar a seção</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Ocorreu um problema ao carregar <strong>{this.props.name}</strong>. Tente recarregar a página.
          </p>
          <Button variant="outline" size="sm" onClick={() => this.setState({ hasError: false })}>
            Tentar novamente
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function LazySection({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <SectionErrorBoundary name={name}>
      <Suspense fallback={<SectionSkeleton />}>{children}</Suspense>
    </SectionErrorBoundary>
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
  "demandas-contratos",
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

// Rotas que vivem fora do prefixo /sala-agil — navegação direta
const EXTERNAL_ROUTES: Record<string, string> = {
  okr: "/okr",
};

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

  const [, startTransition] = useTransition();

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
  }, [loading, section]); // eslint-disable-line

  // ── FIX: rotas externas (ex: /okr) navegam diretamente sem prefixo /sala-agil
  const handleNavigate = (key: string) => {
    if (key in EXTERNAL_ROUTES) {
      navigate(EXTERNAL_ROUTES[key]);
      return;
    }
    startTransition(() => navigate(`/sala-agil/${key}`));
  };

  const isTeamFreeSection = TEAM_FREE_SECTIONS.includes(active);
  const needsTeam = !loading && !isAdmin && !currentTeamId && !isTeamFreeSection;
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
          <div key={teamKey}>
            {active === "dashboard" && <DashboardHome key={`dash-${currentTeamId}-${activeSprint?.id ?? "none"}`} />}
            {active === "equipe" && <DeveloperManager />}
            {active === "board" && (
              <SectionGuard permission="view_kanban">
                <KanbanBoard />
              </SectionGuard>
            )}

            {active === "planning-poker" && (
              <LazySection name="Planning Poker">
                <PlanningPoker />
              </LazySection>
            )}

            {active === "calendario" && (
              <LazySection name="Calendário">
                <CalendarView />
              </LazySection>
            )}

            {active === "retrospectiva" && (
              <LazySection name="Retrospectiva">
                <RetroManager />
              </LazySection>
            )}

            {active === "gerador-apf" && (
              <SectionGuard permission="view_backlog">
                <LazySection name="Gerador APF">
                  <ApfGeneratorPage />
                </LazySection>
              </SectionGuard>
            )}

            {active === "backlog" && (
              <SectionGuard permission="view_backlog">
                <LazySection name="Backlog">
                  <div className="space-y-8">
                    <SprintManager />
                    <UserStoryManager />
                  </div>
                </LazySection>
              </SectionGuard>
            )}

            {active === "epicos" && (
              <SectionGuard permission="view_backlog">
                <LazySection name="Épicos">
                  <EpicManager />
                </LazySection>
              </SectionGuard>
            )}

            {active === "atividades" && (
              <SectionGuard permission="manage_activities">
                <LazySection name="Atividades">
                  <ActivityManager />
                </LazySection>
              </SectionGuard>
            )}

            {active === "impedimentos" && (
              <SectionGuard permission="report_impediment">
                <LazySection name="Impedimentos">
                  <ImpedimentList />
                </LazySection>
              </SectionGuard>
            )}

            {active === "metricas" && (
              <SectionGuard permission="view_dashboard">
                <LazySection name="Métricas">
                  <MetricsDashboard />
                </LazySection>
              </SectionGuard>
            )}

            {active === "relatorios" && (
              <SectionGuard permission="view_dashboard">
                <LazySection name="Relatórios">
                  <SalaAgilReportsPage />
                </LazySection>
              </SectionGuard>
            )}

            {active === "historico" && (
              <SectionGuard permission="view_dashboard">
                <LazySection name="Histórico">
                  <AgileHistory />
                </LazySection>
              </SectionGuard>
            )}

            {active === "demandas-contratos" && (
              <SectionGuard permission="view_backlog">
                <LazySection name="Demandas por Contrato">
                  {currentTeamId && <DemandasPorTimeSection teamId={currentTeamId} />}
                </LazySection>
              </SectionGuard>
            )}

            {active === "times" && (
              <SectionGuard permission="manage_teams">
                <LazySection name="Times">
                  <TeamManager moduleFilter="sala_agil" />
                </LazySection>
              </SectionGuard>
            )}

            {active === "membros" && (
              <SectionGuard permission="manage_users">
                <LazySection name="Membros">
                  <TeamMembersManager />
                </LazySection>
              </SectionGuard>
            )}

            {active === "perfis" && (
              <SectionGuard permission="manage_roles">
                <LazySection name="Perfis">
                  <UserRolesManager />
                </LazySection>
              </SectionGuard>
            )}

            {active === "fluxo" && (
              <SectionGuard permission="manage_workflow">
                <LazySection name="Fluxo">
                  <WorkflowManager />
                </LazySection>
              </SectionGuard>
            )}

            {active === "campos" && (
              <SectionGuard permission="manage_custom_fields">
                <LazySection name="Campos">
                  <CustomFieldManager />
                </LazySection>
              </SectionGuard>
            )}

            {active === "automacoes" && (
              <SectionGuard permission="manage_automations">
                <LazySection name="Automações">
                  <AutomationManager />
                </LazySection>
              </SectionGuard>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Index;
