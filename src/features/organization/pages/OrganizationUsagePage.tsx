import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Boxes,
  Building2,
  FileText,
  Gauge,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import { useOrganizationUsage } from "@/features/organization/hooks/useOrganizationUsage";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

const STATUS_LABELS: Record<string, string> = {
  trialing: "Em avaliação",
  active: "Ativa",
  past_due: "Pagamento pendente",
  suspended: "Suspensa",
  canceled: "Cancelada",
  expired: "Expirada",
};

const FEATURE_LABELS: Record<string, string> = {
  "users.max": "Usuários",
  "projects.max": "Projetos",
  "contracts.max": "Contratos",
  "apf.countings.monthly": "Contagens APF mensais",
  "ai.calls.monthly": "Chamadas de IA mensais",
  "apf.ai_generation": "Geração de APF com IA",
  "reports.advanced": "Relatórios avançados",
  "audit.access": "Auditoria de acessos",
};

function formatLimit(value: number | null) {
  return value === null ? "Ilimitado" : new Intl.NumberFormat("pt-BR").format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function usagePercentage(used: number, limit: number | null) {
  if (limit === null || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function UsageCard({
  title,
  used,
  limit,
  icon: Icon,
}: {
  title: string;
  used: number;
  limit: number | null;
  icon: React.ElementType;
}) {
  const percentage = usagePercentage(used, limit);
  const reached = limit !== null && used >= limit;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <Badge variant={reached ? "destructive" : "secondary"}>
            {limit === null ? "Ilimitado" : `${percentage}%`}
          </Badge>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold">
            {new Intl.NumberFormat("pt-BR").format(used)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              / {formatLimit(limit)}
            </span>
          </p>
        </div>

        {limit !== null && (
          <Progress
            value={percentage}
            className="h-2"
            indicatorClassName={reached ? "bg-destructive" : undefined}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default function OrganizationUsagePage() {
  const navigate = useNavigate();
  const { organization, usage, entitlements, loading, error, refresh } =
    useOrganizationUsage();

  const sortedEntitlements = useMemo(
    () =>
      [...entitlements].sort((left, right) =>
        (FEATURE_LABELS[left.featureKey] ?? left.featureKey).localeCompare(
          FEATURE_LABELS[right.featureKey] ?? right.featureKey,
          "pt-BR",
        ),
      ),
    [entitlements],
  );

  if (!organization) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Alert className="max-w-xl">
          <AlertDescription>
            Selecione uma organização para consultar plano e uso.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Gauge className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">Plano e uso</h1>
              <p className="truncate text-sm text-muted-foreground">
                {organization.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/organization/members")}
            >
              <Users className="mr-2 h-4 w-4" />
              Membros
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:px-8">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : usage ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="md:col-span-2">
                <CardContent className="flex h-full items-center justify-between gap-6 p-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Plano atual</p>
                    <p className="mt-1 text-3xl font-semibold">
                      {PLAN_LABELS[usage.planCode] ?? usage.planCode}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {STATUS_LABELS[usage.subscriptionStatus] ??
                          usage.subscriptionStatus}
                      </Badge>
                      <Badge variant="outline">{organization.status}</Badge>
                    </div>
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                    <Building2 className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">
                    Próxima renovação de cotas
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {formatDate(usage.quotaResetAt)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <UsageCard
                title="Usuários"
                used={usage.usersUsed}
                limit={usage.usersLimit}
                icon={Users}
              />
              <UsageCard
                title="Projetos"
                used={usage.projectsUsed}
                limit={usage.projectsLimit}
                icon={Boxes}
              />
              <UsageCard
                title="Contratos"
                used={usage.contractsUsed}
                limit={usage.contractsLimit}
                icon={FileText}
              />
              <UsageCard
                title="Contagens APF"
                used={usage.apfCountingsUsed}
                limit={usage.apfCountingsLimit}
                icon={Gauge}
              />
              <UsageCard
                title="Chamadas de IA"
                used={usage.aiCallsUsed}
                limit={usage.aiCallsLimit}
                icon={Bot}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recursos do plano</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recurso</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Limite</TableHead>
                      <TableHead>Origem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedEntitlements.map((entitlement) => (
                      <TableRow key={entitlement.featureKey}>
                        <TableCell className="font-medium">
                          {FEATURE_LABELS[entitlement.featureKey] ??
                            entitlement.featureKey}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={entitlement.enabled ? "secondary" : "outline"}
                          >
                            {entitlement.enabled ? "Disponível" : "Indisponível"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatLimit(entitlement.limitValue)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {entitlement.source === "organization_override"
                            ? "Configuração da organização"
                            : "Plano"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : (
          <Alert>
            <AlertDescription>
              Nenhuma assinatura foi encontrada para esta organização.
            </AlertDescription>
          </Alert>
        )}
      </main>
    </div>
  );
}
