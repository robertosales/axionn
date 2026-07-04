import { useNavigate } from "react-router-dom";
import { ClipboardCheck, Kanban, Loader2, LogOut, Wrench } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { AxionLogo } from "@/components/AxionLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  const { profile, signOut, isAdmin } = useAuth();
  const {
    currentOrganization,
    hasModuleAccess,
    moduleAccessLoading,
  } = useOrganization();

  if (moduleAccessLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando módulos da organização...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <AxionLogo size={36} />
            <div>
              <p className="font-semibold">Axion</p>
              <p className="text-xs text-muted-foreground">
                {currentOrganization?.name ?? "Organização"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:block">
              {profile?.display_name ?? profile?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Módulos da organização</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Os acessos abaixo consideram a organização atualmente selecionada.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {MODULES.map((module) => {
            const Icon = module.icon;
            const allowed = isAdmin || hasModuleAccess(module.key);

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
      </main>
    </div>
  );
}
