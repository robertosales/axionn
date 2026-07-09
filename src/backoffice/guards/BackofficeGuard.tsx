import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useBackofficeAuth } from "@/backoffice/hooks/useBackofficeAuth";
import type { BackofficeRole } from "@/backoffice/types/backoffice.types";

export function BackofficeGuard({
  children,
  requiredRoles,
}: {
  children: React.ReactNode;
  requiredRoles?: BackofficeRole[];
}) {
  const { staffMember, loading, hasRole } = useBackofficeAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-3 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Validando backoffice...</p>
        </div>
      </div>
    );
  }

  if (!staffMember) return <Navigate to="/" replace />;
  if (!hasRole(requiredRoles)) return <Navigate to="/backoffice" replace />;

  return <>{children}</>;
}
