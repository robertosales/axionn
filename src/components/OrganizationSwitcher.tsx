import {
  AlertTriangle,
  Building2,
  Check,
  ChevronsUpDown,
  Gauge,
  Loader2,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const STATUS_LABELS = {
  active: "Ativa",
  trial: "Em avaliação",
  suspended: "Suspensa",
  cancelled: "Cancelada",
} as const;

export function OrganizationSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const {
    enabled,
    loading,
    error,
    organizations,
    currentOrganization,
    currentOrganizationId,
    setCurrentOrganizationId,
    isPlatformAdmin,
    isOrganizationAdmin,
  } = useOrganization();

  if (!enabled || !session) return null;

  if (location.pathname.startsWith("/organization/")) return null;

  const baseClass =
    "fixed z-[70] flex h-8 max-w-[210px] items-center gap-2 rounded-lg border bg-background/95 px-2.5 text-xs shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:right-[5.5rem] sm:top-2 max-sm:bottom-4 max-sm:right-4";

  if (loading) {
    return (
      <div className={baseClass} aria-live="polite">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <span className="truncate text-muted-foreground">Carregando empresa...</span>
      </div>
    );
  }

  if (error || organizations.length === 0 || !currentOrganization) {
    return (
      <div
        className={cn(baseClass, "border-amber-300 bg-amber-50 text-amber-900")}
        title={error ?? "Conta sem organização vinculada"}
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Sem organização</span>
      </div>
    );
  }

  const organizationLabel = currentOrganization.name;
  const roleLabel = currentOrganization.isPlatformAdmin
    ? "Admin da plataforma"
    : currentOrganization.membershipRole === "owner"
      ? "Proprietário"
      : currentOrganization.membershipRole === "admin"
        ? "Admin da empresa"
        : "Membro";

  if (organizations.length === 1 && !isOrganizationAdmin) {
    return (
      <div className={baseClass} title={`${organizationLabel} · ${roleLabel}`}>
        {isPlatformAdmin ? (
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
        ) : (
          <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
        )}
        <span className="truncate font-medium">{organizationLabel}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(baseClass, "cursor-pointer hover:bg-accent")}
          aria-label="Opções da organização"
          title={`${organizationLabel} · ${roleLabel}`}
        >
          {isPlatformAdmin ? (
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
          ) : (
            <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
          )}
          <span className="min-w-0 flex-1 truncate text-left font-medium">
            {organizationLabel}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>
          <span className="block text-xs font-semibold">Organização ativa</span>
          <span className="block text-[11px] font-normal text-muted-foreground">
            {organizations.length > 1
              ? "Trocar a organização também redefine o time ativo."
              : roleLabel}
          </span>
        </DropdownMenuLabel>

        {organizations.length > 1 && (
          <>
            <DropdownMenuSeparator />
            {organizations.map((organization) => (
              <DropdownMenuItem
                key={organization.id}
                onClick={() => setCurrentOrganizationId(organization.id)}
                className="cursor-pointer gap-3 py-2.5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  {organization.isPlatformAdmin ? (
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  ) : (
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{organization.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {STATUS_LABELS[organization.status]} · {organization.plan}
                  </p>
                </div>

                {organization.id === currentOrganizationId && (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {isOrganizationAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer gap-3 py-2.5"
              onClick={() => navigate("/organization/members")}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Gerenciar membros</p>
                <p className="text-[11px] text-muted-foreground">
                  Convites, papéis e módulos
                </p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-3 py-2.5"
              onClick={() => navigate("/organization/usage")}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Gauge className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Plano e uso</p>
                <p className="text-[11px] text-muted-foreground">
                  Limites, consumo e recursos
                </p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-3 py-2.5"
              onClick={() => navigate("/organization/usage?view=settings")}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Settings2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Configurações</p>
                <p className="text-[11px] text-muted-foreground">
                  Identidade, contato e auditoria
                </p>
              </div>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
