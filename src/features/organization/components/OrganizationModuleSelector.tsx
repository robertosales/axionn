import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronsUpDown,
  ClipboardCheck,
  CreditCard,
  Gauge,
  Kanban,
  Loader2,
  Settings2,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { AxionLogo } from "@/components/AxionLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
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
    <div className="flex min-h-screen flex-col bg-background">
      <header className="relative z-[80] border-b border-border/70 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
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
                        onClick={() => navigate("/organization/settings")}
                      >
                        <Settings2 className="h-4 w-4" />
                        Configurações
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <ThemeToggle />
            <UserAccountMenu variant="inline" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <Badge variant="secondary" className="mb-3">Central de ambientes</Badge>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Central Axionn</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Escolha o ambiente em que deseja trabalhar.
          </p>
        </div>

        <section aria-labelledby="operational-modules-title">
        <div className="mb-4">
          <h2 id="operational-modules-title" className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Módulos operacionais
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Os acessos consideram a organização atualmente selecionada.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((module) => {
            const Icon = module.icon;
            const allowed = isAdmin || isPlatformAdmin || hasModuleAccess(module.key);

            return (
              <Card
                key={module.key}
                className={allowed ? "group transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg" : "opacity-55"}
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
                <CardContent className="space-y-4">
                  <p className="min-h-10 text-sm leading-6 text-muted-foreground">
                    {module.description}
                  </p>
                  <Button
                    className="w-full"
                    variant={allowed ? "default" : "outline"}
                    disabled={!allowed}
                    onClick={() => navigate(module.path)}
                  >
                    {allowed ? "Acessar módulo" : "Acesso não concedido"}
                    {allowed && <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        </section>

        {(isOrganizationAdmin || isAdmin || isPlatformAdmin || staffMember) && (
          <section className="mt-10 border-t border-border/70 pt-8" aria-labelledby="management-modules-title">
            <div className="mb-4">
              <h2 id="management-modules-title" className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Gestão e administração
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Acessos administrativos exibidos conforme as permissões da sua conta.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(isOrganizationAdmin || isAdmin) && (
                <Card className="group transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <Badge variant="outline">Organização</Badge>
                    </div>
                    <CardTitle className="pt-3 text-lg">Administrador</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="min-h-10 text-sm leading-6 text-muted-foreground">
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
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </CardContent>
                </Card>
              )}

              {staffMember && (
                <Card className="group transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-info/15 bg-info/10">
                        <ShieldCheck className="h-5 w-5 text-info" />
                      </div>
                      <Badge variant="outline">Operação interna</Badge>
                    </div>
                    <CardTitle className="pt-3 text-lg">Backoffice Axionn</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="min-h-10 text-sm leading-6 text-muted-foreground">
                      Gestão interna de clientes, assinaturas, financeiro, equipe e suporte.
                    </p>
                    <Button className="w-full" variant="outline" onClick={() => navigate("/backoffice")}>
                      Acessar backoffice
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </CardContent>
                </Card>
              )}

              {isPlatformAdmin && (
                <Card className="group transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-warning/15 bg-warning/10">
                        <CreditCard className="h-5 w-5 text-warning" />
                      </div>
                      <Badge variant="outline">Admin global</Badge>
                    </div>
                    <CardTitle className="pt-3 text-lg">Configurações e planos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="min-h-10 text-sm leading-6 text-muted-foreground">
                      Planos de pagamento, assinaturas globais, recursos e provedores de inteligência artificial.
                    </p>
                    <Button className="w-full" variant="outline" onClick={() => navigate("/platform/plans")}>
                      Gerenciar plataforma
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
