import { Suspense, lazy, useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import {
  OrganizationProvider,
  useOrganization,
} from "@/contexts/OrganizationContext";
import { SprintProvider } from "@/contexts/SprintContext";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useAppResilience } from "@/hooks/useAppResilience";
import { resolveHomePath } from "@/lib/homeRoute";
import { supabase } from "@/integrations/supabase/client";
import type { BackofficeRole } from "@/backoffice/types/backoffice.types";
import { OKR_V2_ENABLED } from "@/lib/featureFlags";

const Auth = lazy(() => import("./pages/Auth.tsx"));
const AuthCallback = lazy(() => import("./pages/AuthCallback.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const OrganizationSwitcher = lazy(() =>
  import("@/components/OrganizationSwitcher").then((module) => ({ default: module.OrganizationSwitcher })),
);
const GlobalLogoutButton = lazy(() =>
  import("@/components/GlobalLogoutButton").then((module) => ({ default: module.GlobalLogoutButton })),
);
const OrganizationOperationalGuard = lazy(() =>
  import("@/components/OrganizationOperationalGuard").then((module) => ({ default: module.OrganizationOperationalGuard })),
);
const SessionTimeoutAlert = lazy(() =>
  import("@/shared/components/common/SessionTimeoutAlert").then((module) => ({ default: module.SessionTimeoutAlert })),
);
const OnboardingWizard = lazy(() =>
  import("@/components/OnboardingWizard").then((module) => ({ default: module.OnboardingWizard })),
);
const BackofficeGuard = lazy(() =>
  import("@/backoffice/guards/BackofficeGuard").then((module) => ({ default: module.BackofficeGuard })),
);
const BackofficeLayout = lazy(() =>
  import("@/backoffice/components/BackofficeLayout").then((module) => ({ default: module.BackofficeLayout })),
);
const BackofficeMfaGuard = lazy(() =>
  import("@/features/security/components/BackofficeMfaGuard").then((module) => ({ default: module.BackofficeMfaGuard })),
);
const AppShell = lazy(() =>
  import("@/components/layout/AppShell").then((module) => ({ default: module.AppShell })),
);
const QualityAccessGuard = lazy(() =>
  import("@/features/quality/components/QualityAccessGuard").then((module) => ({ default: module.QualityAccessGuard })),
);
const QualityWorkspaceShell = lazy(() =>
  import("@/features/quality/components/QualityWorkspaceShell").then((module) => ({ default: module.QualityWorkspaceShell })),
);
const OkrV2AccessGuard = lazy(() =>
  import("@/features/okr/components/OkrV2AccessGuard").then((module) => ({ default: module.OkrV2AccessGuard })),
);
const Index = lazy(() => import("./pages/Index.tsx"));
const QualityTestCasesPage = lazy(() => import("./features/quality/pages/TestCasesPage"));
const QualityOverviewPage = lazy(() => import("./features/quality/pages/QualityOverviewPage"));
const QualityTestSuitesPage = lazy(() => import("./features/quality/pages/TestSuitesPage"));
const QualityTestPlansPage = lazy(() => import("./features/quality/pages/TestPlansPage"));
const QualityTestRunsPage = lazy(() => import("./features/quality/pages/TestRunsPage"));
const QualityTestRunPage = lazy(() => import("./features/quality/pages/TestRunPage"));
const QualityFindingsPage = lazy(() => import("./features/quality/pages/QualityFindingsPage"));
const QualityCoveragePage = lazy(() => import("./features/quality/pages/QualityCoveragePage"));
const ForcePasswordChange = lazy(() => import("./pages/ForcePasswordChange.tsx"));
const MfaSecurityPage = lazy(() => import("./features/security/pages/MfaSecurityPage"));
const AcceptOrganizationInvitation = lazy(
  () => import("./pages/AcceptOrganizationInvitation.tsx"),
);
const OrganizationMembersPage = lazy(
  () => import("./features/organization/pages/OrganizationMembersPage"),
);
const OrganizationUsagePage = lazy(
  () => import("./features/organization/pages/OrganizationUsagePage"),
);
const OrganizationSettingsPage = lazy(
  () => import("./features/organization/pages/OrganizationSettingsPage"),
);
const OrganizationAdminOverviewPage = lazy(
  () => import("./features/organization/pages/OrganizationAdminOverviewPage"),
);
const OrganizationCompaniesPage = lazy(
  () => import("./features/organization/pages/OrganizationCompaniesPage"),
);
const OrganizationAdminShell = lazy(() =>
  import("./features/organization/components/OrganizationAdminShell").then(
    (module) => ({ default: module.OrganizationAdminShell }),
  ),
);
const OrganizationSubscriptionPage = lazy(
  () => import("./features/organization/pages/OrganizationSubscriptionPage"),
);
const PlatformAIProvidersPage = lazy(
  () => import("./features/platform/pages/PlatformAIProvidersPage"),
);
const PlatformPlansPage = lazy(
  () => import("./features/platform/pages/PlatformPlansPage"),
);
const PlatformSubscriptionsPage = lazy(
  () => import("./features/platform/pages/PlatformSubscriptionsPage"),
);
const BOClientes = lazy(() => import("./backoffice/pages/BOClientes"));
const BODashboard = lazy(() => import("./backoffice/pages/BODashboard"));
const BOEquipe = lazy(() => import("./backoffice/pages/BOEquipe"));
const BOFinanceiro = lazy(() => import("./backoffice/pages/BOFinanceiro"));
const BOSuporte = lazy(() => import("./backoffice/pages/BOSuporte"));
const BOAnalitico = lazy(() => import("./backoffice/pages/BOAnalitico"));
const BOConfiguracoes = lazy(() => import("./backoffice/pages/BOConfiguracoes"));
const BOBriefingIA = lazy(() => import("./backoffice/pages/BOBriefingIA"));
const BORetentionConfig = lazy(() => import("./backoffice/pages/BORetentionConfig"));
const AdminContratosPage = lazy(() =>
  import("./features/admin/pages/AdminContratosPage").then((module) => ({
    default: module.AdminContratosPage,
  })),
);
const AdminGitlabIntegrationsPage = lazy(() =>
  import("./features/admin/pages/AdminGitlabIntegrationsPage").then((module) => ({
    default: module.AdminGitlabIntegrationsPage,
  })),
);
const AdminTimesPage = lazy(() =>
  import("./features/admin/pages/AdminTimesPage").then((module) => ({
    default: module.AdminTimesPage,
  })),
);
const ProjetosAdminPanel = lazy(() =>
  import("./features/admin/components/ProjetosAdminPanel").then((module) => ({
    default: module.ProjetosAdminPanel,
  })),
);
const SustentacaoPage = lazy(
  () => import("./features/sustentacao/SustentacaoPage"),
);
const RdmPage = lazy(() => import("./features/rdm/RdmPage"));
const ModuleSelector = lazy(
  () => import("./features/organization/components/OrganizationModuleSelector"),
);
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const PlanningPokerPage = lazy(() => import("./pages/PlanningPokerPage"));
const RetrospactivaPage = lazy(() => import("./pages/RetrospactivaPage"));
const ContractsPage = lazy(() =>
  import("./features/contracts/components/ContractsDashboard").then((module) => ({
    default: module.ContractsDashboard,
  })),
);
const MeuContratoDashboard = lazy(() =>
  import("./features/contracts/pages/MeuContratoDashboard").then((module) => ({
    default: module.MeuContratoDashboard,
  })),
);
const OkrPage = lazy(() =>
  import("./features/okr/OkrPage").then((module) => ({
    default: module.OkrPage,
  })),
);
const OkrCyclesPage = lazy(() =>
  import("./features/okr/pages/OkrCyclesPage").then((module) => ({
    default: module.OkrCyclesPage,
  })),
);
const OkrObjectivesPage = lazy(() =>
  import("./features/okr/pages/OkrObjectivesPage").then((module) => ({
    default: module.OkrObjectivesPage,
  })),
);
const OkrDashboardPage = lazy(() =>
  import("./features/okr/pages/OkrDashboardPage").then((module) => ({
    default: module.OkrDashboardPage,
  })),
);

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}

function resolveSafeNextPath(search: string) {
  const next = new URLSearchParams(search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, profile, refreshProfile } = useAuth();
  const { showWizard, completeOnboarding } = useOnboarding();
  useAppResilience();

  if (loading) return <PageLoader />;
  if (!session) return <Navigate to="/auth" replace />;
  if (profile?.must_change_password) {
    return (
      <Suspense fallback={<PageLoader />}>
        <ForcePasswordChange onDone={refreshProfile} />
      </Suspense>
    );
  }

  return (
    <>
      <OrganizationOperationalGuard>{children}</OrganizationOperationalGuard>
      <SessionTimeoutAlert />
      <OnboardingWizard open={showWizard} onComplete={completeOnboarding} />
    </>
  );
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { session, loading, isAdmin, roles } = useAuth();
  const {
    loading: organizationLoading,
    isPlatformAdmin,
    isOrganizationAdmin,
    hasModuleAccess,
    moduleAccessLoading,
  } = useOrganization();

  if (loading) return <PageLoader />;
  if (!session) return <>{children}</>;
  if (organizationLoading || moduleAccessLoading) return <PageLoader />;

  const nextPath = resolveSafeNextPath(location.search);
  if (nextPath) return <Navigate to={nextPath} replace />;

  return (
    <Navigate
      to={resolveHomePath({
        isAdmin,
        isPlatformAdmin,
        isOrganizationAdmin,
        hasModuleAccess,
        roles,
      })}
      replace
    />
  );
}

function ModuleRedirect() {
  const { loading, isAdmin, roles } = useAuth();
  const {
    loading: organizationLoading,
    isPlatformAdmin,
    isOrganizationAdmin,
    hasModuleAccess,
    moduleAccessLoading,
  } = useOrganization();

  if (loading || organizationLoading || moduleAccessLoading) return <PageLoader />;

  return (
    <Navigate
      to={resolveHomePath({
        isAdmin,
        isPlatformAdmin,
        isOrganizationAdmin,
        hasModuleAccess,
        roles,
      })}
      replace
    />
  );
}

function ModuleGuard({
  module,
  children,
}: {
  module: "sala_agil" | "sustentacao" | "rdm";
  children: React.ReactNode;
}) {
  const { isAdmin } = useAuth();
  const { isPlatformAdmin, hasModuleAccess, moduleAccessLoading } = useOrganization();

  if (moduleAccessLoading) return <PageLoader />;
  if (isAdmin || isPlatformAdmin || hasModuleAccess(module)) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="space-y-4 text-center">
        <p className="text-lg font-semibold text-destructive">Acesso Restrito</p>
        <p className="text-muted-foreground">
          Você não tem permissão para acessar este módulo nesta organização.
        </p>
      </div>
    </div>
  );
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  const { loading: organizationLoading, isPlatformAdmin } = useOrganization();
  if (loading || organizationLoading) return <PageLoader />;
  if (!isAdmin && !isPlatformAdmin) return <Navigate to="/modulos" replace />;
  return <>{children}</>;
}

function OrganizationAdminGuard({ children }: { children: React.ReactNode }) {
  const { loading, currentOrganizationId, isOrganizationAdmin } = useOrganization();
  if (loading) return <PageLoader />;
  if (!currentOrganizationId || !isOrganizationAdmin) {
    return <Navigate to="/modulos" replace />;
  }
  return <>{children}</>;
}

function PlatformAdminGuard({ children }: { children: React.ReactNode }) {
  const { loading: authLoading } = useAuth();
  const { loading: organizationLoading, isPlatformAdmin } = useOrganization();
  if (authLoading || organizationLoading) return <PageLoader />;
  if (!isPlatformAdmin) return <Navigate to="/organization/admin" replace />;
  return <>{children}</>;
}

function AuthenticatedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, profile, refreshProfile } = useAuth();
  useAppResilience();

  if (loading) return <PageLoader />;
  if (!session) return <Navigate to="/auth" replace />;
  if (profile?.must_change_password) {
    return (
      <Suspense fallback={<PageLoader />}>
        <ForcePasswordChange onDone={refreshProfile} />
      </Suspense>
    );
  }

  return (
    <>
      {children}
      <SessionTimeoutAlert />
    </>
  );
}

function LegacyOperationalRoute({
  organizationPath,
  platformPath,
  children,
}: {
  organizationPath?: string;
  platformPath?: string;
  children: React.ReactNode;
}) {
  const { loading, isOrganizationAdmin, isPlatformAdmin } = useOrganization();
  const [flags, setFlags] = useState({
    consoleEnabled: false,
    legacyFallbackEnabled: true,
  });
  const [flagLoading, setFlagLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadFlags() {
      const [consoleResult, fallbackResult] = await Promise.all([
        (supabase as any).rpc("is_organization_operational_console_enabled"),
        (supabase as any).rpc("is_legacy_operational_admin_fallback_enabled"),
      ]);

      if (!cancelled) {
        setFlags({
          consoleEnabled: !consoleResult.error && consoleResult.data === true,
          legacyFallbackEnabled:
            fallbackResult.error || fallbackResult.data !== false,
        });
        setFlagLoading(false);
      }
    }

    void loadFlags();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || flagLoading) return <PageLoader />;

  if (flags.consoleEnabled && isPlatformAdmin && platformPath) {
    return <Navigate to={platformPath} replace />;
  }

  if (
    flags.consoleEnabled &&
    !flags.legacyFallbackEnabled &&
    isOrganizationAdmin &&
    !isPlatformAdmin &&
    organizationPath
  ) {
    return <Navigate to={organizationPath} replace />;
  }

  return <>{children}</>;
}

function ContractAdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, roles, loading } = useAuth();
  if (loading) return null;
  if (isAdmin || roles.includes("admin_contrato")) return <>{children}</>;
  return <Navigate to="/modulos" replace />;
}

function OrganizationConsoleRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <OrganizationAdminGuard>
        <OrganizationAdminShell>{children}</OrganizationAdminShell>
      </OrganizationAdminGuard>
    </ProtectedRoute>
  );
}

function BackofficeRoute({
  children,
  requiredRoles,
}: {
  children: React.ReactNode;
  requiredRoles?: BackofficeRole[];
}) {
  return (
    <AuthenticatedRoute>
      <BackofficeGuard requiredRoles={requiredRoles}>
        <BackofficeMfaGuard>
          <BackofficeLayout>{children}</BackofficeLayout>
        </BackofficeMfaGuard>
      </BackofficeGuard>
    </AuthenticatedRoute>
  );
}

function AuthenticatedChrome() {
  const { session, loading } = useAuth();
  if (loading || !session) return null;

  return (
    <Suspense fallback={null}>
      <GlobalLogoutButton />
      <OrganizationSwitcher />
    </Suspense>
  );
}

function AppRoutes() {
  return (
    <SprintProvider>
      <Toaster />
      <Sonner />
      <AuthenticatedChrome />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/security/mfa" element={<AuthenticatedRoute><MfaSecurityPage /></AuthenticatedRoute>} />
          <Route path="/accept-invitation" element={<AcceptOrganizationInvitation />} />
          <Route path="/" element={<ProtectedRoute><ModuleRedirect /></ProtectedRoute>} />
          <Route path="/modulos" element={<ProtectedRoute><ModuleSelector /></ProtectedRoute>} />

          <Route path="/backoffice" element={<BackofficeRoute><BODashboard /></BackofficeRoute>} />
          <Route path="/backoffice/clientes" element={<BackofficeRoute requiredRoles={["admin", "comercial", "financeiro"]}><BOClientes /></BackofficeRoute>} />
          <Route path="/backoffice/assinaturas" element={<BackofficeRoute requiredRoles={["admin", "financeiro", "comercial"]}><PlatformSubscriptionsPage embedded /></BackofficeRoute>} />
          <Route path="/backoffice/financeiro" element={<BackofficeRoute requiredRoles={["admin", "financeiro"]}><BOFinanceiro /></BackofficeRoute>} />
          <Route path="/backoffice/equipe" element={<BackofficeRoute requiredRoles={["admin"]}><BOEquipe /></BackofficeRoute>} />
          <Route path="/backoffice/suporte" element={<BackofficeRoute requiredRoles={["admin", "suporte", "comercial"]}><BOSuporte /></BackofficeRoute>} />
          <Route path="/backoffice/analitico" element={<BackofficeRoute requiredRoles={["admin", "financeiro", "comercial"]}><BOAnalitico /></BackofficeRoute>} />
          <Route path="/backoffice/briefing-ia" element={<BackofficeRoute requiredRoles={["admin", "dev"]}><BOBriefingIA /></BackofficeRoute>} />
          <Route path="/backoffice/retencao-briefing" element={<BackofficeRoute requiredRoles={["admin"]}><BORetentionConfig /></BackofficeRoute>} />
          <Route path="/backoffice/configuracoes" element={<BackofficeRoute requiredRoles={["admin"]}><BOConfiguracoes /></BackofficeRoute>} />

          <Route path="/organization/admin" element={<OrganizationConsoleRoute><OrganizationAdminOverviewPage /></OrganizationConsoleRoute>} />
          <Route path="/organization/companies" element={<OrganizationConsoleRoute><OrganizationCompaniesPage /></OrganizationConsoleRoute>} />
          <Route path="/organization/contracts" element={<OrganizationConsoleRoute><AdminContratosPage /></OrganizationConsoleRoute>} />
          <Route path="/organization/projects" element={<OrganizationConsoleRoute><ProjetosAdminPanel /></OrganizationConsoleRoute>} />
          <Route path="/organization/teams" element={<OrganizationConsoleRoute><AdminTimesPage /></OrganizationConsoleRoute>} />
          <Route path="/organization/members" element={<OrganizationConsoleRoute><OrganizationMembersPage /></OrganizationConsoleRoute>} />
          <Route path="/organization/usage" element={<OrganizationConsoleRoute><OrganizationUsagePage /></OrganizationConsoleRoute>} />
          <Route path="/organization/subscription" element={<OrganizationConsoleRoute><OrganizationSubscriptionPage /></OrganizationConsoleRoute>} />
          <Route path="/organization/settings" element={<OrganizationConsoleRoute><OrganizationSettingsPage /></OrganizationConsoleRoute>} />

          <Route
            path="/platform"
            element={<ProtectedRoute><PlatformAdminGuard><Navigate to="/platform/plans" replace /></PlatformAdminGuard></ProtectedRoute>}
          />
          <Route
            path="/platform/plans"
            element={<ProtectedRoute><PlatformAdminGuard><PlatformPlansPage /></PlatformAdminGuard></ProtectedRoute>}
          />
          <Route
            path="/platform/subscriptions"
            element={<ProtectedRoute><PlatformAdminGuard><PlatformSubscriptionsPage /></PlatformAdminGuard></ProtectedRoute>}
          />
          <Route
            path="/platform/ai-providers"
            element={<ProtectedRoute><PlatformAdminGuard><PlatformAIProvidersPage /></PlatformAdminGuard></ProtectedRoute>}
          />
          <Route
            path="/admin/gitlab-integrations"
            element={<Navigate to="/organization/gitlab-integrations" replace />}
          />
          <Route
            path="/organization/gitlab-integrations"
            element={
              <OrganizationConsoleRoute>
                <AdminGuard><AdminGitlabIntegrationsPage /></AdminGuard>
              </OrganizationConsoleRoute>
            }
          />

          <Route
            path="/dashboard-admin"
            element={
              <ProtectedRoute>
                <LegacyOperationalRoute organizationPath="/organization/admin" platformPath="/platform">
                  <AdminGuard><AdminDashboard /></AdminGuard>
                </LegacyOperationalRoute>
              </ProtectedRoute>
            }
          />
          <Route path="/meu-contrato" element={<ProtectedRoute><ContractAdminGuard><MeuContratoDashboard /></ContractAdminGuard></ProtectedRoute>} />
          <Route
            path="/contratos"
            element={
              <ProtectedRoute>
                <LegacyOperationalRoute organizationPath="/organization/contracts">
                  <AdminGuard><ContractsPage /></AdminGuard>
                </LegacyOperationalRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/okr"
            element={
              <ProtectedRoute>
                {OKR_V2_ENABLED
                  ? <Navigate to="/okr/dashboard" replace />
                  : <OkrPage />}
              </ProtectedRoute>
            }
          />
          <Route path="/okr/dashboard" element={<ProtectedRoute><OkrV2AccessGuard feature="okr.view"><AppShell module="sala_agil"><OkrDashboardPage /></AppShell></OkrV2AccessGuard></ProtectedRoute>} />
          <Route path="/okr/ciclos" element={<ProtectedRoute><OkrV2AccessGuard feature="okr.cycle_management"><AppShell module="sala_agil"><OkrCyclesPage /></AppShell></OkrV2AccessGuard></ProtectedRoute>} />
          <Route path="/okr/objectives" element={<ProtectedRoute><OkrV2AccessGuard feature="okr.view"><AppShell module="sala_agil"><OkrObjectivesPage /></AppShell></OkrV2AccessGuard></ProtectedRoute>} />
          <Route
            path="/sala-agil"
            element={<ProtectedRoute><ModuleGuard module="sala_agil"><Navigate to="/sala-agil/dashboard" replace /></ModuleGuard></ProtectedRoute>}
          />
          <Route path="/sala-agil/planning-poker" element={<ProtectedRoute><ModuleGuard module="sala_agil"><PlanningPokerPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/sala-agil/retrospectiva" element={<ProtectedRoute><ModuleGuard module="sala_agil"><RetrospactivaPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/sala-agil/qualidade" element={<ProtectedRoute><ModuleGuard module="sala_agil"><QualityAccessGuard><AppShell module="sala_agil"><QualityWorkspaceShell><QualityOverviewPage /></QualityWorkspaceShell></AppShell></QualityAccessGuard></ModuleGuard></ProtectedRoute>} />
          <Route path="/sala-agil/qualidade/casos" element={<ProtectedRoute><ModuleGuard module="sala_agil"><QualityAccessGuard><AppShell module="sala_agil"><QualityWorkspaceShell><QualityTestCasesPage /></QualityWorkspaceShell></AppShell></QualityAccessGuard></ModuleGuard></ProtectedRoute>} />
          <Route path="/sala-agil/qualidade/suites" element={<ProtectedRoute><ModuleGuard module="sala_agil"><QualityAccessGuard><AppShell module="sala_agil"><QualityWorkspaceShell><QualityTestSuitesPage /></QualityWorkspaceShell></AppShell></QualityAccessGuard></ModuleGuard></ProtectedRoute>} />
          <Route path="/sala-agil/qualidade/planos" element={<ProtectedRoute><ModuleGuard module="sala_agil"><QualityAccessGuard><AppShell module="sala_agil"><QualityWorkspaceShell><QualityTestPlansPage /></QualityWorkspaceShell></AppShell></QualityAccessGuard></ModuleGuard></ProtectedRoute>} />
          <Route path="/sala-agil/qualidade/execucoes" element={<ProtectedRoute><ModuleGuard module="sala_agil"><QualityAccessGuard><AppShell module="sala_agil"><QualityWorkspaceShell><QualityTestRunsPage /></QualityWorkspaceShell></AppShell></QualityAccessGuard></ModuleGuard></ProtectedRoute>} />
          <Route path="/sala-agil/qualidade/execucoes/:id" element={<ProtectedRoute><ModuleGuard module="sala_agil"><QualityAccessGuard><AppShell module="sala_agil"><QualityWorkspaceShell><QualityTestRunPage /></QualityWorkspaceShell></AppShell></QualityAccessGuard></ModuleGuard></ProtectedRoute>} />
          <Route path="/sala-agil/qualidade/achados" element={<ProtectedRoute><ModuleGuard module="sala_agil"><QualityAccessGuard><AppShell module="sala_agil"><QualityWorkspaceShell><QualityFindingsPage /></QualityWorkspaceShell></AppShell></QualityAccessGuard></ModuleGuard></ProtectedRoute>} />
          <Route path="/sala-agil/qualidade/cobertura" element={<ProtectedRoute><ModuleGuard module="sala_agil"><QualityAccessGuard><AppShell module="sala_agil"><QualityWorkspaceShell><QualityCoveragePage /></QualityWorkspaceShell></AppShell></QualityAccessGuard></ModuleGuard></ProtectedRoute>} />
          <Route path="/sala-agil/metricas/relatorios" element={<Navigate to="/sala-agil/relatorios" replace />} />
          <Route path="/sala-agil/metricas/reports" element={<Navigate to="/sala-agil/relatorios" replace />} />
          <Route path="/sala-agil/metricas/release" element={<Navigate to="/sala-agil/releases" replace />} />
          <Route path="/sala-agil/metricas/releases" element={<Navigate to="/sala-agil/releases" replace />} />
          <Route path="/metricas/relatorios" element={<Navigate to="/sala-agil/relatorios" replace />} />
          <Route path="/metricas/releases" element={<Navigate to="/sala-agil/releases" replace />} />
          <Route path="/sala-agil/gerador-apf" element={<Navigate to="/sala-agil/medicao-evidencias" replace />} />
          <Route path="/sala-agil/relatorios/evidencias" element={<Navigate to="/sala-agil/medicao-evidencias" replace />} />
          <Route path="/sala-agil/:section" element={<ProtectedRoute><ModuleGuard module="sala_agil"><Index /></ModuleGuard></ProtectedRoute>} />
          <Route
            path="/sustentacao"
            element={<ProtectedRoute><ModuleGuard module="sustentacao"><Navigate to="/sustentacao/dashboard" replace /></ModuleGuard></ProtectedRoute>}
          />
          <Route path="/sustentacao/*" element={<ProtectedRoute><ModuleGuard module="sustentacao"><SustentacaoPage /></ModuleGuard></ProtectedRoute>} />
          <Route
            path="/rdm"
            element={<ProtectedRoute><ModuleGuard module="rdm"><Navigate to="/rdm/dashboard" replace /></ModuleGuard></ProtectedRoute>}
          />
          <Route path="/rdm/*" element={<ProtectedRoute><ModuleGuard module="rdm"><RdmPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </SprintProvider>
  );
}

function TeamContextRoutes() {
  const { teamContextVersion } = useAuth();
  return <AppRoutes key={teamContextVersion} />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
            <TeamContextRoutes />
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
