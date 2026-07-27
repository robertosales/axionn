import type { ReactNode } from "react";
import { Loader2, Lock } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OKR_V2_ENABLED } from "@/lib/featureFlags";
import type { OkrFeatureKey } from "../entitlements/okrFeatures";
import { useOkrEntitlements } from "../hooks/useOkrEntitlements";

interface OkrV2AccessGuardProps {
  feature: OkrFeatureKey;
  children: ReactNode;
}

export function OkrV2AccessGuard({
  feature,
  children,
}: OkrV2AccessGuardProps) {
  const { error, resolve } = useOkrEntitlements();
  const resolution = resolve(feature);

  if (!OKR_V2_ENABLED) {
    return <Navigate to="/okr" replace />;
  }

  if (resolution.loading) {
    return (
      <div
        className="flex min-h-[40vh] items-center justify-center"
        role="status"
        aria-label="Validando acesso ao OKR V2"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!resolution.unavailable && !error && resolution.enabled) {
    return children;
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Alert variant="default" className="border-dashed">
        <Lock className="h-4 w-4" />
        <AlertTitle>OKR V2 indisponível</AlertTitle>
        <AlertDescription>
          {resolution.unavailable || error
            ? "Não foi possível validar o entitlement do OKR V2. O acesso foi bloqueado por segurança."
            : `A capacidade ${feature} não está incluída no plano atual.`}
        </AlertDescription>
      </Alert>
    </div>
  );
}
