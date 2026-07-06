import type { ReactNode } from "react";
import { Building2, LockKeyhole, RefreshCw } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";

export function OrganizationOperationalGuard({
  children,
}: {
  children: ReactNode;
}) {
  const {
    enabled,
    loading,
    error,
    currentOrganization,
    canOperate,
    operationBlockReason,
    refreshOrganizations,
  } = useOrganization();

  if (!enabled) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-3 text-center">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Validando acesso da organização...
          </p>
        </div>
      </div>
    );
  }

  if (canOperate) return <>{children}</>;

  const hasOrganization = Boolean(currentOrganization);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-6">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
          {hasOrganization ? (
            <LockKeyhole className="h-6 w-6" />
          ) : (
            <Building2 className="h-6 w-6" />
          )}
        </div>

        <h1 className="text-lg font-semibold">
          {hasOrganization
            ? "Operações temporariamente bloqueadas"
            : "Organização não disponível"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {error ?? operationBlockReason}
        </p>

        {currentOrganization && (
          <div className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="font-medium">{currentOrganization.name}</span>
            <span className="ml-2 text-xs uppercase text-muted-foreground">
              {currentOrganization.status}
            </span>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="mt-5"
          onClick={() => void refreshOrganizations()}
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Verificar novamente
        </Button>
      </div>
    </div>
  );
}
