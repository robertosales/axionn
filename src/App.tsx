import { Suspense, lazy } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";
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
  moduleAccess?: string | null;
  hasModuleAccess: (module: string) => boolean;
  moduleRolesCount: number;
  roles: string[];
  allowLegacyFallback: boolean;
}): string {
  const {
    isAdmin,
    moduleAccess,
    hasModuleAccess,
    moduleRolesCount,
    roles,
    allowLegacyFallback,
  } = options;

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

  if (allowLegacyFallback && moduleRolesCount === 0 && moduleAccess) {
    if (moduleAccess === "sustentacao") return "/sustentacao";
    if (moduleAccess === "sala_agil") return "/sala-agil/dashboard";
    if (moduleAccess === "rdm") return "/rdm";
    if (moduleAccess === "admin") return "/modulos";
  }

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
  const { session, loading, profile, isAdmin, roles } = useAuth();
  const {
    enabled: organizationTenancyEnabled,
    hasModuleAccess,
    moduleRoles,
  } = useOrganization();

  if (loading) return <PageLoader />;
  if (!session) return <>{children}</>;

  const nextPath = resolveSafeNextPath(location.search);
  if (nextPath) return <Navigate to={nextPath} replace />;

  return (
    <Navigate
      to={resolveHomePath({
        isAdmin,
        moduleAccess: profile?.module_access,
        hasModuleAccess,
        moduleRolesCount: moduleRoles.length,
        roles,
        allowLegacyFallback: !organizationTenancyEnabled,
      })}
      replace
    />
  );
}

function ModuleRedirect() {
  const { profile, loading, isAdmin, roles } = useAuth();
  const {
    enabled: organizationTenancyEnabled,
    hasModuleAccess,
    moduleRoles,
    moduleAccessLoading,
  } = useOrganization();

  if (loading || moduleAccessLoading) return <PageLoader />;

  return (
    <Navigate
      to={resolveHomePath({
        isAdmin,
        moduleAccess: profile?.module_access,
        hasModuleAccess,
        moduleRolesCount: moduleRoles.length,
        roles,
        allowLegacyFallback: !organizationTenancyEnabled,
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
  const { hasModuleAccess, moduleAccessLoading } = useOrganization();

  if (moduleAccessLoading) return <PageLoader />;
  if (isAdmin || hasModuleAccess(module)) return <>{children}</>;

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
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/modulos" replace />;
  return <>{children}</>;
}

function OrganizationAdminGuard({ children }: { children: React.ReactNode }) {
  const { loading, isOrganizationAdmin } = useOrganization();
  if (loading) return <PageLoader />;
  if (!isOrganizationAdmin) return <Navigate to="/modulos" replace />;
  return <>{children}</>;
}

function ContractAdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, roles, loading } = useAuth();
  if (loading) return null;
  if (isAdmin || roles.includes("admin_contrato")) return <>{children}</>;
  return <Navigate to="/modulos" replace />;
}

function AppRoutes() {
  return (
    <SprintProvider>
      <Toaster />
      <Sonner />
      <OrganizationSwitcher />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/accept-invitation"
            element={<AcceptOrganizationInvitation />}
          />
          <Route
            path="/"
            element={<ProtectedRoute><ModuleRedirect /></ProtectedRoute>}
          />
          <Route
            path="/modulos"
            element={<ProtectedRoute><ModuleSelector /></ProtectedRoute>}
          />
          <Route
            path="/organization/members"
            element={
              <ProtectedRoute>
                <OrganizationAdminGuard>
                  <OrganizationMembersPage />
                </OrganizationAdminGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/organization/usage"
            element={
              <ProtectedRoute>
                <OrganizationAdminGuard>
                  <OrganizationUsagePage />
                </OrganizationAdminGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard-admin"
            element={<ProtectedRoute><AdminGuard><AdminDashboard /></AdminGuard></ProtectedRoute>}
          />
          <Route
            path="/meu-contrato"
            element={<ProtectedRoute><ContractAdminGuard><MeuContratoDashboard /></ContractAdminGuard></ProtectedRoute>}
          />
          <Route
            path="/contratos"
            element={<ProtectedRoute><AdminGuard><ContractsPage /></AdminGuard></ProtectedRoute>}
          />
          <Route
            path="/okr"
            element={<ProtectedRoute><OkrPage /></ProtectedRoute>}
          />
          <Route
            path="/sala-agil"
            element={
              <ProtectedRoute>
                <ModuleGuard module="sala_agil">
                  <Navigate to="/sala-agil/dashboard" replace />
                </ModuleGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sala-agil/planning-poker"
            element={<ProtectedRoute><ModuleGuard module="sala_agil"><PlanningPokerPage /></ModuleGuard></ProtectedRoute>}
          />
          <Route
            path="/sala-agil/retrospectiva"
            element={<ProtectedRoute><ModuleGuard module="sala_agil"><RetrospactivaPage /></ModuleGuard></ProtectedRoute>}
          />
          <Route
            path="/sala-agil/:section"
            element={<ProtectedRoute><ModuleGuard module="sala_agil"><Index /></ModuleGuard></ProtectedRoute>}
          />
          <Route
            path="/sustentacao/*"
            element={<ProtectedRoute><ModuleGuard module="sustentacao"><SustentacaoPage /></ModuleGuard></ProtectedRoute>}
          />
          <Route
            path="/rdm/*"
            element={<ProtectedRoute><ModuleGuard module="rdm"><RdmPage /></ModuleGuard></ProtectedRoute>}
          />
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
