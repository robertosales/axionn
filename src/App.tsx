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
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";
import { GlobalLogoutButton } from "@/components/GlobalLogoutButton";
import { OrganizationOperationalGuard } from "@/components/OrganizationOperationalGuard";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import {
  OrganizationProvider,
  useOrganization,
} from "@/contexts/OrganizationContext";
import { SprintProvider } from "@/contexts/SprintContext";
import { SessionTimeoutAlert } from "@/shared/components/common/SessionTimeoutAlert";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useAppResilience } from "@/hooks/useAppResilience";
import { supabase } from "@/integrations/supabase/client";

import Auth from "./pages/Auth.tsx";
import AuthCallback from "./pages/AuthCallback.tsx";
import NotFound from "./pages/NotFound.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";

const Index = lazy(() => import("./pages/Index.tsx"));
const ForcePasswordChange = lazy(() => import("./pages/ForcePasswordChange.tsx"));
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
const PlatformAIProvidersPage = lazy(
  () => import("./features/platform/pages/PlatformAIProvidersPage"),
);
const AdminContratosPage = lazy(() =>
  import("./features/admin/pages/AdminContratosPage").then((module) => ({
    default: module.AdminContratosPage,
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

function resolveHomePath(options: {
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  isOrganizationAdmin: boolean;
  hasModuleAccess: (module: string) => boolean;
  roles: string[];
}): string {
  const {
    isAdmin,
    isPlatformAdmin,
    isOrganizationAdmin,
    hasModuleAccess,
    roles,
  } = options;

  if (isPlatformAdmin) return "/platform";
  if (isOrganizationAdmin) return "/organization/admin";
  if (isAdmin) return "/dashboard-admin";
  if (roles.includes("admin_contrato")) return "/meu-contrato";

  const agil = hasModuleAccess("sala_agil");
  const sustentacao = hasModuleAccess("sustentacao");
  const rdm = hasModuleAccess("rdm");
  const count = [agil, sustentacao, rdm].filter(Boolean).length;

  if (count >= 2) return "/modulos";
  if (sustentacao) return "/sustentacao";
  if (agil) return "/sala-agil/dashboard";
  if (rdm) return "/rdm";
  return "/modulos";
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
  const { loading, isPlatformAdmin } = useAuth();
  if (loading) return <PageLoader />;
  if (!isPlatformAdmin) return <Navigate to="/organization/admin" replace />;
  return <>{children}</>;
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

function AppRoutes() {
  return (
    <SprintProvider>
      <Toaster />
      <Sonner />
      <GlobalLogoutButton />
      <OrganizationSwitcher />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/accept-invitation" element={<AcceptOrganizationInvitation />} />
          <Route path="/" element={<ProtectedRoute><ModuleRedirect /></ProtectedRoute>} />
          <Route path="/modulos" element={<ProtectedRoute><ModuleSelector /></ProtectedRoute>} />

          <Route path="/organization/admin" element={<OrganizationConsoleRoute><OrganizationAdminOverviewPage /></OrganizationConsoleRoute>} />
          <Route path="/organization/companies" element={<OrganizationConsoleRoute><OrganizationCompaniesPage /></OrganizationConsoleRoute>} />
          <Route path="/organization/contracts" element={<OrganizationConsoleRoute><AdminContratosPage /></OrganizationConsoleRoute>} />
          <Route path="/organization/projects" element={<OrganizationConsoleRoute><ProjetosAdminPanel /></OrganizationConsoleRoute>} />
          <Route path="/organization/teams" element={<OrganizationConsoleRoute><AdminTimesPage /></OrganizationConsoleRoute>} />
          <Route path="/organization/members" element={<OrganizationConsoleRoute><OrganizationMembersPage /></OrganizationConsoleRoute>} />
          <Route path="/organization/usage" element={<OrganizationConsoleRoute><OrganizationUsagePage /></OrganizationConsoleRoute>} />
          <Route path="/organization/settings" element={<OrganizationConsoleRoute><OrganizationSettingsPage /></OrganizationConsoleRoute>} />

          <Route
            path="/platform"
            element={<ProtectedRoute><PlatformAdminGuard><Navigate to="/platform/ai-providers" replace /></PlatformAdminGuard></ProtectedRoute>}
          />
          <Route
            path="/platform/ai-providers"
            element={<ProtectedRoute><PlatformAdminGuard><PlatformAIProvidersPage /></PlatformAdminGuard></ProtectedRoute>}
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
          <Route path="/okr" element={<ProtectedRoute><OkrPage /></ProtectedRoute>} />
          <Route
            path="/sala-agil"
            element={<ProtectedRoute><ModuleGuard module="sala_agil"><Navigate to="/sala-agil/dashboard" replace /></ModuleGuard></ProtectedRoute>}
          />
          <Route path="/sala-agil/planning-poker" element={<ProtectedRoute><ModuleGuard module="sala_agil"><PlanningPokerPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/sala-agil/retrospectiva" element={<ProtectedRoute><ModuleGuard module="sala_agil"><RetrospactivaPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/sala-agil/:section" element={<ProtectedRoute><ModuleGuard module="sala_agil"><Index /></ModuleGuard></ProtectedRoute>} />
          <Route path="/sustentacao/*" element={<ProtectedRoute><ModuleGuard module="sustentacao"><SustentacaoPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="/rdm/*" element={<ProtectedRoute><ModuleGuard module="rdm"><RdmPage /></ModuleGuard></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </SprintProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <OrganizationProvider>
            <AppRoutes />
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
