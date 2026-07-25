import type { ReactNode } from "react";
import { Loader2, RefreshCw, ShieldX } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { QUALITY_MANAGEMENT_ENABLED } from "@/lib/featureFlags";
import { useQualityPermissions } from "../hooks/useQualityPermissions";

interface QualityAccessGuardProps {
  children: ReactNode;
  requireWrite?: boolean;
  fallback?: ReactNode;
}

export function QualityAccessGuard({
  children,
  requireWrite = false,
  fallback,
}: QualityAccessGuardProps) {
  const {
    can,
    hasQualityEntitlement,
    entitlementLoading,
    entitlementError,
  } = useQualityPermissions();

  if (!QUALITY_MANAGEMENT_ENABLED) {
    return <Navigate to="/sala-agil/dashboard" replace />;
  }

  if (entitlementLoading) {
    return (
      <div
        className="flex min-h-[40vh] items-center justify-center"
        role="status"
        aria-label="Validando acesso ao Quality Intelligence"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const authorized =
    hasQualityEntitlement &&
    can.viewQuality &&
    (!requireWrite || can.canWrite);

  if (!entitlementError && authorized) {
    return children;
  }

  if (fallback) return fallback;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldX className="h-6 w-6" />
        </div>

        <h1 className="text-lg font-semibold">Acesso não autorizado</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {entitlementError
            ? "Não foi possível validar o acesso ao módulo de Qualidade."
            : "Sua organização ou seu perfil não possui acesso a este recurso."}
        </p>

        {entitlementError && (
          <Button
            variant="outline"
            size="sm"
            className="mt-5"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        )}
      </div>
    </div>
  );
}
