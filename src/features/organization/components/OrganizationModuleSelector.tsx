import { useNavigate } from "react-router-dom";
import {
  Building2,
  Check,
  ChevronsUpDown,
  ClipboardCheck,
  Gauge,
  Kanban,
  Loader2,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { AxionLogo } from "@/components/AxionLogo";
import { UserAccountMenu } from "@/components/GlobalLogoutButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBackofficeAuth } from "@/backoffice/hooks/useBackofficeAuth";

interface ModuleDefinition {
  key: "sala_agil" | "sustentacao" | "rdm";
  title: string;
  description: string;
  badge: string;
  path: string;
  icon: React.ElementType;
}

const MODULES: ModuleDefinition[] = [
  {
    key: "sala_agil",
    title: "Sala Ágil",
    description:
      "Sprints, Kanban, planning poker, retrospectivas e métricas de time.",
    badge: "Scrum / Kanban",
    path: "/sala-agil",
    icon: Kanban,
  },
  {
    key: "sustentacao",
    title: "Sustentação",
    description:
      "Demandas de manutenção, RHMs, atividades e relatórios gerenciais.",
    badge: "Manutenção",
    path: "/sustentacao",
    icon: Wrench,
  },
  {
    key: "rdm",
    title: "RDM",
    description:
      "Planejamento, aprovação e acompanhamento de mudanças operacionais.",
    badge: "Mudanças",
    path: "/rdm",
    icon: ClipboardCheck,
  },
];

export default function OrganizationModuleSelector() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { staffMember, loading: backofficeLoading } = useBackofficeAuth();
  const {
    organizations,
    currentOrganization,
    currentOrganizationId,
    setCurrentOrganizationId,
    isPlatformAdmin,
    isOrganizationAdmin,
    hasModuleAccess,
    moduleAccessLoading,
  } = useOrganization();

  if (moduleAccessLoading || backofficeLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando ambientes...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="relative z-[80] border-b bg-background">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <AxionLogo size={34} />
            <div className="min-w-0 leading-tight">
              <p className="text-base font-semibold">Axion</p>
              <p className="truncate text-xs text-muted-foreground">
                {currentOrganization?.name ?? "Organização"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {currentOrganization && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-10 min-w-[190px] max-w-[240px] items-center gap-2 rounded-xl border bg-background px-3 text-sm shadow-sm transition-colors hover:bg-accent"
                    aria-label="Opções da organização"
                  >
                    {isPlatformAdmin ? (
                      <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <Building2 className="h-4 w-4 shrink-0 text-primary" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-left font-medium">
                      {currentOrganization.name}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Organização ativa</DropdownMenuLabel>
                  {organizations.length > 1 && (
                    <>
                      <DropdownMenuSeparator />
                      {organizations.map((organization) => (
                        <DropdownMenuItem
                          key={organization.id}
                          className="cursor-pointer gap-3"
                          onClick={() => setCurrentOrganizationId(organization.id)}
                        >
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">
                            {organization.name}
                          </span>
                          {organization.id === currentOrganizationId && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  {isOrganizationAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer gap-2"
                        onClick={() => navigate("/organization/members")}
                      >
                        <Users className="h-4 w-4" />
                        Gerenciar membros
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer gap-2"
                        onClick={() => navigate("/organization/usage")}
                      >
                        <Gauge className="h-4 w-4" />
                        Plano e uso
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer gap-2"
                        onClick={() => navigate("/organization/usage?view=settings")}
                      >
                        <Settings2 className="h-4 w-4" />
                        Configurações
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <UserAccountMenu variant="inline" />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Central Axionn</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Escolha o ambiente em que deseja trabalhar.
          </p>
        </div>

        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Módulos operacionais
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Os acessos consideram a organização atualmente selecionada.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {MODULES.map((module) => {
            const Icon = module.icon;
            const allowed = isAdmin || isPlatformAdmin || hasModuleAccess(module.key);

            return (
              <Card
                key={module.key}
                className={allowed ? "transition-shadow hover:shadow-md" : "opacity-50"}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <Badge variant={allowed ? "secondary" : "outline"}>
                      {allowed ? module.badge : "Sem acesso"}
                    </Badge>
                  </div>
                  <CardTitle className="pt-3 text-lg">{module.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="min-h-12 text-sm text-muted-foreground">
                    {module.description}
                  </p>
                  <Button
                    className="w-full"
                    variant={allowed ? "default" : "outline"}
                    disabled={!allowed}
                    onClick={() => navigate(module.path)}
                  >
                    {allowed ? "Acessar módulo" : "Acesso não concedido"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {(isOrganizationAdmin || isAdmin || isPlatformAdmin || staffMember) && (
          <>
            <div className="mb-4 mt-10">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Gestão e administração
              </h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {(isOrganizationAdmin || isAdmin) && (
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <CardTitle className="pt-3 text-lg">Administrador</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <p className="min-h-12 text-sm text-muted-foreground">
                      Empresas, contratos, projetos, times, usuários e configurações da organização.
                    </p>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() =>
                        navigate(isOrganizationAdmin ? "/organization/admin" : "/dashboard-admin")
                      }
                    >
                      Acessar administração
                    </Button>
                  </CardContent>
                </Card>
              )}

              {staffMember && (
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10">
                      <ShieldCheck className="h-5 w-5 text-cyan-600" />
                    </div>
                    <CardTitle className="pt-3 text-lg">Backoffice Axionn</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <p className="min-h-12 text-sm text-muted-foreground">
                      Gestão interna de clientes, assinaturas, financeiro, equipe e suporte.
                    </p>
                    <Button className="w-full" variant="outline" onClick={() => navigate("/backoffice")}>
                      Acessar backoffice
                    </Button>
                  </CardContent>
                </Card>
              )}

              {isPlatformAdmin && (
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10">
                      <SlidersHorizontal className="h-5 w-5 text-violet-600" />
                    </div>
                    <CardTitle className="pt-3 text-lg">Configuração da plataforma</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <p className="min-h-12 text-sm text-muted-foreground">
                      Catálogo de planos, assinaturas globais e provedores de inteligência artificial.
                    </p>
                    <Button className="w-full" variant="outline" onClick={() => navigate("/platform")}>
                      Acessar plataforma
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
