import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useOkrEntitlements } from "@/features/okr/hooks/useOkrEntitlements";
import type { OkrFeatureKey } from "@/features/okr/entitlements/okrFeatures";

interface OkrEntitlementGuardProps {
  feature: OkrFeatureKey | string;
  children: ReactNode;
  fallback?: ReactNode;
  /** Quando true, esconde o conteúdo em vez de mostrar mensagem. */
  silent?: boolean;
}

/**
 * PR 1 — Guard declarativo de features OKR.
 *
 * Bloqueia a árvore filha quando a organização não possui a capability.
 * Enquanto carrega, mostra o conteúdo em estado neutro (o backend continua
 * sendo a autoridade final via triggers `enforce_okr_*`).
 */
export function OkrEntitlementGuard({
  feature,
  children,
  fallback,
  silent = false,
}: OkrEntitlementGuardProps) {
  const { resolve } = useOkrEntitlements();
  const resolution = resolve(feature);

  if (resolution.loading || resolution.unavailable) return <>{children}</>;
  if (resolution.enabled) return <>{children}</>;

  if (silent) return null;
  if (fallback !== undefined) return <>{fallback}</>;

  return (
    <Alert variant="default" className="border-dashed">
      <Lock className="h-4 w-4" />
      <AlertTitle>Recurso indisponível no plano atual</AlertTitle>
      <AlertDescription>
        A capacidade <code className="font-mono">{feature}</code> não está incluída no
        plano contratado. Fale com o administrador da organização para revisar o
        plano.
      </AlertDescription>
    </Alert>
  );
}