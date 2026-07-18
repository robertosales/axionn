import type { ReactNode } from "react";
import { ShieldX, RefreshCw } from "lucide-react";
import { useQualityPermissions } from "@/features/quality/hooks/useQualityPermissions";
import { Button } from "@/components/ui/button";

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
  const { can } = useQualityPermissions();

  if (can.viewQuality && (!requireWrite || can.canWrite)) {
    return <>{children}</>;
  }

  if (fallback) return <>{fallback}</>;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldX className="h-6 w-6" />
        </div>

        <h1 className="text-lg font-semibold">Acesso não autorizado</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Você não tem permissão para acessar o módulo de Qualidade.
          {!requireWrite && " Entre em contato com o administrador da organização."}
          {requireWrite &&
            " Este recurso requer permissão de escrita no módulo de Qualidade."}
        </p>

        <Button
          variant="outline"
          size="sm"
          className="mt-5"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
