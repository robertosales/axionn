import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { BACKOFFICE_MFA_REQUIRED } from "@/lib/featureFlags";
import { useMfaStatus } from "@/features/security/hooks/useMfaStatus";

export function BackofficeMfaGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { currentLevel, verifiedFactors, loading } = useMfaStatus();

  if (!BACKOFFICE_MFA_REQUIRED) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-3 text-center" role="status">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Validando proteção em duas etapas...</p>
        </div>
      </div>
    );
  }

  if (verifiedFactors.length === 0 || currentLevel !== "aal2") {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/security/mfa?required=true&next=${next}`} replace />;
  }

  return <>{children}</>;
}
