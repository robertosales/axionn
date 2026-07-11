import { Link } from "react-router-dom";
import {
  Building2,
  FileText,
  FolderKanban,
  Gauge,
  GitBranch,
  Settings2,
  Users,
  UsersRound,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useCompanies } from "@/features/admin/hooks/useCompanies";
import { useContracts } from "@/features/admin/hooks/useContracts";
import { useProjetosAdmin } from "@/features/admin/hooks/useProjetosAdmin";
import { useTeamsAdmin } from "@/features/admin/hooks/useTeamsAdmin";
import { useOrganizationMembers } from "@/features/organization/hooks/useOrganizationMembers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const shortcuts = [
  { to: "/organization/companies", label: "Empresas", icon: Building2 },
  { to: "/organization/contracts", label: "Contratos", icon: FileText },
  { to: "/organization/projects", label: "Projetos", icon: FolderKanban },
  { to: "/organization/teams", label: "Times", icon: UsersRound },
  { to: "/organization/members", label: "Usuarios", icon: Users },
  { to: "/organization/usage", label: "Plano e uso", icon: Gauge },
  { to: "/organization/settings", label: "Configuracoes", icon: Settings2 },
  { to: "/admin/gitlab-integrations", label: "GitLab", icon: GitBranch },
] as const;

function MetricCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | string;
  loading?: boolean;
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{loading ? "..." : value}</p>
      </CardContent>
    </Card>
  );
}

export default function OrganizationAdminOverviewPage() {
  const { currentOrganization, moduleRoles } = useOrganization();
  const { kpis: companyKpis, loading: companiesLoading } = useCompanies();
  const { kpis: contractKpis, loading: contractsLoading } = useContracts();
  const { projetos, loading: projectsLoading } = useProjetosAdmin();
  const { teams, loading: teamsLoading } = useTeamsAdmin();
  const { members, loading: membersLoading } = useOrganizationMembers();

  const activeProjects = projetos.filter((project) => project.status !== "archived").length;
  const activeTeams = teams.length;
  const activeMembers = members.filter((member) => member.isActive).length;
  const enabledModules = [...new Set(moduleRoles.map((moduleRole) => moduleRole.module))];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Visao geral operacional</h1>
          <p className="text-sm text-muted-foreground">
            Contexto tenant-scoped da organizacao ativa.
          </p>
        </div>
        {currentOrganization && (
          <Badge variant="outline" className="w-fit">
            {currentOrganization.name} · {currentOrganization.plan}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Empresas clientes"
          value={companyKpis.total}
          loading={companiesLoading}
        />
        <MetricCard
          label="Contratos ativos"
          value={contractKpis.active}
          loading={contractsLoading}
        />
        <MetricCard
          label="Projetos ativos"
          value={activeProjects}
          loading={projectsLoading}
        />
        <MetricCard
          label="Times ativos"
          value={activeTeams}
          loading={teamsLoading}
        />
        <MetricCard
          label="Membros ativos"
          value={activeMembers}
          loading={membersLoading}
        />
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-sm">Modulos habilitados</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {enabledModules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum modulo explicito encontrado para esta organizacao.
            </p>
          ) : (
            enabledModules.map((moduleKey) => (
              <Badge key={moduleKey} variant="secondary">
                {moduleKey}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {shortcuts.map(({ to, label, icon: Icon }) => (
          <Button
            key={to}
            asChild
            variant="outline"
            className="h-12 justify-start gap-2"
          >
            <Link to={to}>
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
