import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AgileHistory } from "@/components/AgileHistory";
import { TeamSelectionModal } from "@/shared/components/common/TeamSelectionModal";
import { SprintManager } from "@/components/SprintManager";
import { DeveloperManager } from "@/components/DeveloperManager";
import { UserStoryManager } from "@/components/UserStoryManager";
import { ActivityManager } from "@/components/ActivityManager";
import { KanbanBoard } from "@/components/KanbanBoard";
import { MetricsDashboard } from "@/components/MetricsDashboard";
import { ImpedimentList } from "@/components/ImpedimentManager";
import { EpicManager } from "@/components/EpicManager";
import { WorkflowManager } from "@/components/WorkflowManager";
import { CustomFieldManager } from "@/components/CustomFieldManager";
import { AutomationManager } from "@/components/AutomationManager";
import { TeamManager } from "@/components/TeamManager";
import { TeamMembersManager } from "@/components/TeamMembersManager";
import { UserRolesManager } from "@/components/UserRolesManager";
import { DashboardHome } from "@/components/DashboardHome";
import { CalendarView } from "@/components/CalendarView";
import { PlanningPoker } from "@/components/PlanningPoker";
import { RetroManager } from "@/components/RetroManager";
import { ApfGeneratorPage } from "@/features/apf/components/ApfGeneratorPage";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useSprint } from "@/contexts/SprintContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Building2, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

// ─── Seções válidas ──────────────────────────────────────────────────────────
const VALID_SECTIONS = [
  "dashboard", "backlog", "board", "planning-poker", "retrospectiva",
  "releases", "relatorios", "notificacoes", "gerador-apf", "metricas",
  "historico", "calendario", "equipe", "epicos", "atividades", "impedimentos",
  "times", "membros", "perfis", "fluxo", "campos", "automacoes",
] as const;

export type SectionKey = typeof VALID_SECTIONS[number];

// Seções que NUNCA exigem time selecionado (acesso universal)
const TEAM_FREE_SECTIONS: SectionKey[] = [
  "planning-poker", "retrospectiva", "times", "membros", "perfis",
  "fluxo", "campos", "automacoes",
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

  const { loading, currentTeamId, setCurrentTeamId, teams, hasPermission, isAdmin, roles } = useAuth();
  const { activeSprint } = useSprint();
  const [showTeamModal, setShowTeamModal] = React.useState(false);
  const { showWizard, completeOnboarding } = useOnboarding();

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
  }, [loading, teams]);

  // Só redireciona seção inválida após auth carregar
  useEffect(() => {
    if (loading) return;
    if (section && !VALID_SECTIONS.includes(section as SectionKey)) {
      navigate("/sala-agil/dashboard", { replace: true });
    }
  }, [loading, section]);

  const handleNavigate = (key: string) => navigate(`/sala-agil/${key}`);

  // FIX v2: não bloqueia se:
  // 1. usuário é admin (isAdmin)
  // 2. a seção está na lista de TEAM_FREE_SECTIONS (planning-poker, retrospectiva, etc)
  // 3. ainda está carregando (evita flash de "selecione um time")
  const isTeamFreeSection = TEAM_FREE_SECTIONS.includes(active);
  const needsTeam = !loading && !isAdmin && !currentTeamId && !isTeamFreeSection;

  return (
    <AppShell module="sala_agil" activeKey={active} onNavigate={handleNavigate}>
      <TeamSelectionModal
        open={showTeamModal}
        teams={moduleTeams}
        moduleLabel="Sala Ágil"
        onSelect={(id) => { setCurrentTeamId(id); setShowTeamModal(false); }}
        onClose={() => setShowTeamModal(false)}
      />

      <OnboardingWizard open={showWizard && !loading} onComplete={completeOnboarding} />

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
          <>
            {active === "dashboard"      && <DashboardHome key={`dash-${currentTeamId}-${activeSprint?.id ?? "none"}`} />}
            {active === "planning-poker" && <PlanningPoker />}
            {active === "equipe"         && <DeveloperManager />}
            {active === "calendario"     && <CalendarView />}
            {active === "retrospectiva"  && <RetroManager />}
            {active === "gerador-apf"    && <SectionGuard permission="view_backlog"><ApfGeneratorPage /></SectionGuard>}
            {active === "backlog"        && (
              <SectionGuard permission="view_backlog">
                <div className="space-y-8"><SprintManager /><UserStoryManager /></div>
              </SectionGuard>
            )}
            {active === "epicos"       && <SectionGuard permission="view_backlog"><EpicManager /></SectionGuard>}
            {active === "board"        && <SectionGuard permission="view_kanban"><KanbanBoard /></SectionGuard>}
            {active === "atividades"   && <SectionGuard permission="manage_activities"><ActivityManager /></SectionGuard>}
            {active === "impedimentos" && <SectionGuard permission="report_impediment"><ImpedimentList /></SectionGuard>}
            {active === "metricas"     && <SectionGuard permission="view_dashboard"><MetricsDashboard /></SectionGuard>}
            {active === "historico"    && <SectionGuard permission="view_dashboard"><AgileHistory /></SectionGuard>}
            {active === "times"        && <SectionGuard permission="manage_teams"><TeamManager moduleFilter="sala_agil" /></SectionGuard>}
            {active === "membros"      && <SectionGuard permission="manage_users"><TeamMembersManager /></SectionGuard>}
            {active === "perfis"       && <SectionGuard permission="manage_roles"><UserRolesManager /></SectionGuard>}
            {active === "fluxo"        && <SectionGuard permission="manage_workflow"><WorkflowManager /></SectionGuard>}
            {active === "campos"       && <SectionGuard permission="manage_custom_fields"><CustomFieldManager /></SectionGuard>}
            {active === "automacoes"   && <SectionGuard permission="manage_automations"><AutomationManager /></SectionGuard>}
          </>
        )}
      </div>
    </AppShell>
  );
};

export default Index;
