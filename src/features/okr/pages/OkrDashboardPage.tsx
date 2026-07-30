import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Download,
  FileText,
  Gauge,
  Layers3,
  Loader2,
  Lock,
  RefreshCw,
  Target,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrganization } from "@/contexts/OrganizationContext";
import { logUserUsageEvent, TelemetryEvents } from "@/lib/telemetry";
import {
  compareOkrCycles,
  formatOkrPercent,
  healthLabel,
  teamsForCycle,
} from "../domain/dashboardAnalytics";
import { useOkrCycles } from "../hooks/useOkrCycles";
import { useOkrDashboardV2 } from "../hooks/useOkrDashboardV2";
import { useOkrEntitlements } from "../hooks/useOkrEntitlements";
import type {
  OkrDashboardCycleSummary,
  OkrDashboardFocusObjective,
  OkrDashboardMode,
} from "../types/dashboard";
import { exportOkrV2 } from "../utils/okrExportV2";

const TEAM_CHART_CONFIG = {
  progress: { label: "Progresso", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

const HEALTH_COLORS: Record<string, string> = {
  on_track: "hsl(142 71% 38%)",
  attention: "hsl(38 92% 45%)",
  at_risk: "hsl(var(--destructive))",
  no_data: "hsl(var(--muted-foreground))",
};

const HEALTH_BADGE: Record<string, string> = {
  on_track: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  attention: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  at_risk: "border-destructive/30 bg-destructive/10 text-destructive",
  off_track: "border-destructive/30 bg-destructive/10 text-destructive",
  no_data: "border-border bg-muted text-muted-foreground",
  completed: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
};

function numberValue(value: number | null | undefined) {
  return value == null ? "—" : new Intl.NumberFormat("pt-BR").format(value);
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Carregando dashboard de OKRs" role="status">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-xl xl:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  description: string;
  icon: typeof Target;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const toneClass = {
    default: "bg-primary/10 text-primary",
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    danger: "bg-destructive/10 text-destructive",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  }[tone];

  return (
    <Card>
      <CardContent className="flex min-h-32 items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}

function DeltaIndicator({
  value,
  inverse = false,
  suffix = "",
}: {
  value: number | null;
  inverse?: boolean;
  suffix?: string;
}) {
  if (value == null) return <span className="text-muted-foreground">Sem comparação</span>;
  const positive = inverse ? value <= 0 : value >= 0;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : ArrowRight;
  return (
    <span className={positive ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}>
      <Icon className="mr-1 inline h-4 w-4" aria-hidden="true" />
      {value > 0 ? "+" : ""}
      {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}
      {suffix}
    </span>
  );
}

function HealthDistribution({ cycle }: { cycle: OkrDashboardCycleSummary | undefined }) {
  const data = cycle
    ? [
        { health: "on_track", label: "No caminho", value: cycle.on_track },
        { health: "attention", label: "Atenção", value: cycle.attention },
        { health: "at_risk", label: "Em risco", value: cycle.at_risk },
        { health: "no_data", label: "Sem dados", value: cycle.no_data },
      ]
    : [];
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Saúde dos objetivos</CardTitle>
        <p className="text-sm text-muted-foreground">
          Distribuição do ciclo selecionado, com valores exatos na tabela.
        </p>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
            Ainda não há objetivos medidos neste ciclo.
          </div>
        ) : (
          <>
            <ChartContainer
              config={{ value: { label: "Objetivos", color: "hsl(var(--primary))" } }}
              className="h-52 w-full"
              aria-label={`Distribuição de saúde: ${data.map((item) => `${item.label}, ${item.value}`).join("; ")}`}
            >
              <BarChart data={data} accessibilityLayer margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {data.map((item) => (
                    <Cell key={item.health} fill={HEALTH_COLORS[item.health]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm" role="list" aria-label="Valores de saúde">
              {data.map((item) => (
                <div key={item.health} className="flex items-center justify-between rounded-lg border px-3 py-2" role="listitem">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: HEALTH_COLORS[item.health] }}
                      aria-hidden="true"
                    />
                    {item.label}
                  </span>
                  <strong className="tabular-nums">{item.value}</strong>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FocusObjectives({ objectives }: { objectives: OkrDashboardFocusObjective[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Objetivos que pedem atenção</CardTitle>
        <p className="text-sm text-muted-foreground">
          Prioridade por risco, ausência de dados e medições desatualizadas.
        </p>
      </CardHeader>
      <CardContent>
        {objectives.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center text-center">
            <CheckCircle2 className="mb-3 h-8 w-8 text-emerald-600" aria-hidden="true" />
            <p className="font-medium">Nenhuma atenção imediata</p>
            <p className="mt-1 text-sm text-muted-foreground">O ciclo não possui objetivos críticos.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {objectives.slice(0, 7).map((objective) => (
              <div key={objective.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium leading-5">{objective.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {objective.team_name ?? "Sem time"} · {objective.key_results} KRs
                    {objective.stale_key_results > 0
                      ? ` · ${objective.stale_key_results} sem atualização`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className={HEALTH_BADGE[objective.health] ?? HEALTH_BADGE.no_data}>
                    {healthLabel(objective.health)}
                  </Badge>
                  <span className="min-w-16 text-right text-sm font-semibold tabular-nums">
                    {formatOkrPercent(objective.progress)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function OkrDashboardPage() {
  const navigate = useNavigate();
  const { currentOrganizationId, currentOrganization } = useOrganization();
  const cyclesQuery = useOkrCycles();
  const entitlements = useOkrEntitlements();
  const canExecutive = entitlements.hasFeature("okr.executive_dashboard");
  const canExport = entitlements.hasFeature("okr.export");
  const [mode, setMode] = useState<OkrDashboardMode>("operational");
  const [primaryCycleId, setPrimaryCycleId] = useState<string | null>(null);
  const [compareCycleId, setCompareCycleId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  useEffect(() => {
    if (primaryCycleId || cyclesQuery.cycles.length === 0) return;
    const primary =
      cyclesQuery.cycles.find((cycle) => cycle.status === "active") ??
      cyclesQuery.cycles.find((cycle) => cycle.status === "planning") ??
      cyclesQuery.cycles[0];
    setPrimaryCycleId(primary?.id ?? null);
  }, [cyclesQuery.cycles, primaryCycleId]);

  useEffect(() => {
    if (mode === "executive" && !canExecutive) setMode("operational");
  }, [canExecutive, mode]);

  useEffect(() => {
    void logUserUsageEvent({
      event_type: TelemetryEvents.DASHBOARD_VIEWED,
      entity_type: "okr_dashboard",
      source: "web",
      metadata_json: { mode },
    });
  }, [mode]);

  const dashboard = useOkrDashboardV2(
    primaryCycleId,
    mode === "executive" ? compareCycleId : null,
    mode,
  );
  const primary = dashboard.data?.cycles.find((cycle) => cycle.id === dashboard.data?.primary_cycle_id);
  const comparison = dashboard.data?.cycles.find((cycle) => cycle.id === dashboard.data?.compare_cycle_id);
  const comparisonDelta = compareOkrCycles(primary, comparison);
  const primaryTeams = teamsForCycle(dashboard.data?.teams ?? [], primary?.id ?? null);
  const compareTeams = teamsForCycle(dashboard.data?.teams ?? [], comparison?.id ?? null);
  const teamChart = useMemo(
    () =>
      primaryTeams.slice(0, 12).map((team) => ({
        team: team.team_name,
        progress: team.average_progress ?? 0,
        hasData: team.average_progress != null,
      })),
    [primaryTeams],
  );
  const exportCycleIds = [primary?.id, comparison?.id].filter(Boolean) as string[];
  const exportCycleCodes = [primary?.code, comparison?.code].filter(Boolean) as string[];

  const handleExport = async (format: "csv" | "pdf") => {
    if (!currentOrganizationId) return;
    setExporting(format);
    try {
      const payload = await exportOkrV2({
        organizationId: currentOrganizationId,
        cycleIds: exportCycleIds,
        cycleCodes: exportCycleCodes,
        format,
      });
      toast.success("Exportação concluída", {
        description:
          payload.limit == null
            ? `${payload.rows.length} linhas exportadas.`
            : `${payload.rows.length} linhas · ${payload.used}/${payload.limit} exportações no período.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível gerar o arquivo.";
      toast.error("Falha na exportação", { description: message });
    } finally {
      setExporting(null);
    }
  };

  return (
    <AppShell module="sala_agil">
      <div id="okr-dashboard-content" className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Inteligência de OKRs</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Acompanhamento operacional e leitura executiva dos ciclos da organização.
              </p>
              {dashboard.data?.generated_at && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Atualizado em {new Date(dashboard.data.generated_at).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="h-11" variant="outline" onClick={() => navigate("/okr/ciclos")}>
              <Layers3 className="mr-2 h-4 w-4" aria-hidden="true" />
              Ciclos
            </Button>
            <Button className="h-11" variant="outline" onClick={() => navigate("/okr/objectives")}>
              <Target className="mr-2 h-4 w-4" aria-hidden="true" />
              Objetivos
            </Button>
            {canExport && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="h-11" disabled={Boolean(exporting) || !primary}>
                    {exporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void handleExport("csv")}>
                    <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                    CSV
                  </DropdownMenuItem>
                  {currentOrganization?.plan === "enterprise" && (
                    <DropdownMenuItem onClick={() => void handleExport("pdf")}>
                      <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                      PDF executivo
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="grid gap-4 p-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="okr-primary-cycle" className="text-sm font-medium">Ciclo principal</label>
              <Select value={primaryCycleId ?? ""} onValueChange={setPrimaryCycleId}>
                <SelectTrigger id="okr-primary-cycle" className="h-11">
                  <SelectValue placeholder="Selecione o ciclo" />
                </SelectTrigger>
                <SelectContent>
                  {cyclesQuery.cycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id}>
                      {cycle.code} · {cycle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="okr-compare-cycle" className="text-sm font-medium">
                Comparar com <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <Select
                value={compareCycleId ?? "none"}
                onValueChange={(value) => setCompareCycleId(value === "none" ? null : value)}
                disabled={!canExecutive}
              >
                <SelectTrigger id="okr-compare-cycle" className="h-11">
                  <SelectValue placeholder="Sem comparação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem comparação</SelectItem>
                  {cyclesQuery.cycles
                    .filter((cycle) => cycle.id !== primaryCycleId)
                    .map((cycle) => (
                      <SelectItem key={cycle.id} value={cycle.id}>
                        {cycle.code} · {cycle.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {!canExecutive && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  Comparação disponível no dashboard executivo.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs value={mode} onValueChange={(value) => setMode(value as OkrDashboardMode)}>
          <TabsList className="h-auto w-full justify-start overflow-x-auto p-1 sm:w-auto" aria-label="Visões do dashboard">
            <TabsTrigger value="operational" className="min-h-11 gap-2">
              <Activity className="h-4 w-4" aria-hidden="true" />
              Operacional
            </TabsTrigger>
            <TabsTrigger value="executive" className="min-h-11 gap-2" disabled={!canExecutive}>
              <Gauge className="h-4 w-4" aria-hidden="true" />
              Executivo
              {!canExecutive && <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
            </TabsTrigger>
          </TabsList>

          {dashboard.isLoading ? (
            <DashboardSkeleton />
          ) : dashboard.isError ? (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Não foi possível carregar o dashboard</AlertTitle>
              <AlertDescription className="mt-2">
                <p>Verifique seu acesso ao ciclo ou tente novamente.</p>
                <Button className="mt-3 h-11" variant="outline" onClick={() => void dashboard.refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Tentar novamente
                </Button>
              </AlertDescription>
            </Alert>
          ) : !primary ? (
            <Card className="mt-4 border-dashed">
              <CardContent className="flex min-h-64 flex-col items-center justify-center p-6 text-center">
                <Target className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
                <h2 className="font-semibold">Nenhum ciclo disponível</h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Crie um ciclo para começar a acompanhar objetivos, KRs e indicadores.
                </p>
                <Button className="mt-4 h-11" onClick={() => navigate("/okr/ciclos")}>Criar ciclo</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <TabsContent value="operational" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Progresso médio"
                    value={formatOkrPercent(primary.average_progress)}
                    description={`${primary.active_objectives} objetivos ativos no ciclo`}
                    icon={Gauge}
                    tone="success"
                  />
                  <MetricCard
                    label="Alertas abertos"
                    value={dashboard.data?.operations.open_alerts ?? 0}
                    description={`${dashboard.data?.operations.critical_alerts ?? 0} de alta prioridade`}
                    icon={AlertTriangle}
                    tone={(dashboard.data?.operations.critical_alerts ?? 0) > 0 ? "danger" : "default"}
                  />
                  <MetricCard
                    label="KRs sem atualização"
                    value={primary.stale_key_results}
                    description="Mais de oito dias sem nova medição"
                    icon={RefreshCw}
                    tone={primary.stale_key_results > 0 ? "warning" : "success"}
                  />
                  <MetricCard
                    label="Iniciativas bloqueadas"
                    value={dashboard.data?.operations.blocked_initiatives ?? 0}
                    description={`${dashboard.data?.operations.overdue_initiatives ?? 0} iniciativas atrasadas`}
                    icon={Layers3}
                    tone={(dashboard.data?.operations.blocked_initiatives ?? 0) > 0 ? "warning" : "default"}
                  />
                </div>
                <div className="grid gap-4 xl:grid-cols-5">
                  <div className="xl:col-span-2"><HealthDistribution cycle={primary} /></div>
                  <div className="xl:col-span-3"><FocusObjectives objectives={dashboard.data?.focus_objectives ?? []} /></div>
                </div>
              </TabsContent>

              <TabsContent value="executive" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Progresso consolidado"
                    value={formatOkrPercent(primary.average_progress)}
                    description={comparison ? `versus ${comparison.code}` : `${primary.objectives} objetivos no ciclo`}
                    icon={Gauge}
                    tone="success"
                  />
                  <MetricCard
                    label="Objetivos no caminho"
                    value={primary.on_track}
                    description={`${primary.at_risk} em risco · ${primary.attention} em atenção`}
                    icon={CheckCircle2}
                    tone="success"
                  />
                  <MetricCard
                    label="Times acompanhados"
                    value={primaryTeams.length}
                    description={`${primary.key_results} Key Results consolidados`}
                    icon={Users}
                  />
                  <MetricCard
                    label="Cobertura de medição"
                    value={
                      primary.key_results === 0
                        ? "Sem KRs"
                        : formatOkrPercent(
                            ((primary.key_results - primary.stale_key_results) / primary.key_results) * 100,
                          )
                    }
                    description={`${primary.stale_key_results} KRs desatualizados`}
                    icon={Activity}
                    tone={primary.stale_key_results > 0 ? "warning" : "success"}
                  />
                </div>

                {comparison && comparisonDelta && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        Comparação {primary.code} × {comparison.code}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Variação do ciclo principal em relação ao ciclo comparado.
                      </p>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border p-4">
                        <p className="text-sm text-muted-foreground">Progresso médio</p>
                        <p className="mt-2 text-xl font-semibold tabular-nums">
                          <DeltaIndicator value={comparisonDelta.progressDelta} suffix=" p.p." />
                        </p>
                      </div>
                      <div className="rounded-xl border p-4">
                        <p className="text-sm text-muted-foreground">Objetivos em risco</p>
                        <p className="mt-2 text-xl font-semibold tabular-nums">
                          <DeltaIndicator value={comparisonDelta.atRiskDelta} inverse />
                        </p>
                      </div>
                      <div className="rounded-xl border p-4">
                        <p className="text-sm text-muted-foreground">KRs desatualizados</p>
                        <p className="mt-2 text-xl font-semibold tabular-nums">
                          <DeltaIndicator value={comparisonDelta.staleDelta} inverse />
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid gap-4 xl:grid-cols-5">
                  <Card className="xl:col-span-3">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Progresso por time</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Ranking do ciclo {primary.code}; valores sem medição aparecem como zero no gráfico e como “Sem dados” na tabela.
                      </p>
                    </CardHeader>
                    <CardContent>
                      {teamChart.length === 0 ? (
                        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                          Nenhum time com objetivos neste ciclo.
                        </div>
                      ) : (
                        <>
                          <ChartContainer
                            config={TEAM_CHART_CONFIG}
                            className="h-72 w-full"
                            aria-label={`Progresso por time: ${teamChart.map((item) => `${item.team}, ${item.hasData ? `${item.progress}%` : "sem dados"}`).join("; ")}`}
                          >
                            <BarChart data={teamChart} accessibilityLayer layout="vertical" margin={{ left: 12, right: 16 }}>
                              <CartesianGrid horizontal={false} />
                              <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                              <YAxis type="category" dataKey="team" width={110} tickLine={false} axisLine={false} />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Bar dataKey="progress" fill="var(--color-progress)" radius={[0, 6, 6, 0]} />
                            </BarChart>
                          </ChartContainer>
                          <div className="mt-4 overflow-x-auto rounded-lg border">
                            <table className="w-full text-sm">
                              <caption className="sr-only">Dados de progresso e risco por time</caption>
                              <thead className="bg-muted/50 text-left">
                                <tr>
                                  <th className="px-3 py-2 font-medium">Time</th>
                                  <th className="px-3 py-2 text-right font-medium">Progresso</th>
                                  <th className="px-3 py-2 text-right font-medium">Em risco</th>
                                  <th className="px-3 py-2 text-right font-medium">KRs desatualizados</th>
                                </tr>
                              </thead>
                              <tbody>
                                {primaryTeams.map((team) => (
                                  <tr key={team.team_id ?? team.team_name} className="border-t">
                                    <td className="px-3 py-2 font-medium">{team.team_name}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{formatOkrPercent(team.average_progress)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{team.at_risk}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{team.stale_key_results}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                  <div className="xl:col-span-2"><HealthDistribution cycle={primary} /></div>
                </div>

                {comparison && compareTeams.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Leitura do ciclo comparado</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div><p className="text-xs text-muted-foreground">Ciclo</p><p className="mt-1 font-semibold">{comparison.code}</p></div>
                      <div><p className="text-xs text-muted-foreground">Progresso</p><p className="mt-1 font-semibold tabular-nums">{formatOkrPercent(comparison.average_progress)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Objetivos</p><p className="mt-1 font-semibold tabular-nums">{numberValue(comparison.objectives)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Times</p><p className="mt-1 font-semibold tabular-nums">{compareTeams.length}</p></div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </AppShell>
  );
}

export default OkrDashboardPage;
