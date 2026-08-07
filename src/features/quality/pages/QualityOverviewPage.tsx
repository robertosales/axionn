import { ArrowRight, Bug, CheckCircle2, ClipboardCheck, ClipboardList, FolderTree, GitBranch, LayoutDashboard, PlayCircle, ShieldAlert } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/contexts/OrganizationContext";
import { QUALITY_MANAGEMENT_ENABLED } from "@/lib/featureFlags";
import { useQualityOverview } from "../hooks/useQualityOverview";
import { QualitySectionHeader } from "../components/QualitySectionHeader";

const journey = [
  { title: "Desenhe", description: "Casos versionados e rastreáveis.", route: "/sala-agil/qualidade/casos", icon: ClipboardCheck },
  { title: "Organize", description: "Suítes imutáveis por fluxo e objetivo.", route: "/sala-agil/qualidade/suites", icon: FolderTree },
  { title: "Planeje", description: "Escopo congelado para a validação.", route: "/sala-agil/qualidade/planos", icon: ClipboardList },
  { title: "Execute", description: "Resultados e evidências auditáveis.", route: "/sala-agil/qualidade/execucoes", icon: PlayCircle },
  { title: "Trate", description: "Achados ligados à origem da falha.", route: "/sala-agil/qualidade/achados", icon: Bug },
  { title: "Decida", description: "Cobertura ponta a ponta e lacunas de risco.", route: "/sala-agil/qualidade/cobertura", icon: GitBranch },
];

export default function QualityOverviewPage() {
  const { currentOrganizationId } = useOrganization();
  const overview = useQualityOverview(currentOrganizationId);
  if (!QUALITY_MANAGEMENT_ENABLED) return <Navigate to="/sala-agil/dashboard" replace />;
  if (!currentOrganizationId) return <div className="p-8 text-center text-muted-foreground">Selecione uma organização.</div>;
  const metrics = [
    { label: "Casos ativos", value: overview.data?.activeCases, icon: ClipboardCheck }, { label: "Casos aprovados", value: overview.data?.approvedCases, icon: CheckCircle2 }, { label: "Suítes", value: overview.data?.suites, icon: FolderTree }, { label: "Planos ativos", value: overview.data?.activePlans, icon: ClipboardList }, { label: "Execuções ativas", value: overview.data?.activeRuns, icon: PlayCircle }, { label: "Falhas", value: overview.data?.failedItems, icon: ShieldAlert, danger: true }, { label: "Achados ativos", value: overview.data?.activeFindings, icon: Bug, danger: true },
  ];
  return <main className="mx-auto w-full max-w-[1500px] space-y-6 px-4 pb-8 pt-5 md:px-8 md:pt-6"><QualitySectionHeader icon={LayoutDashboard} title="Visão Geral" count={overview.data?.activeCases ?? 0} action={<Button asChild size="sm" className="gap-1.5"><Link to="/sala-agil/qualidade/cobertura">Ver cobertura<ArrowRight className="h-4 w-4" /></Link></Button>} />
    {overview.isError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Não foi possível carregar os indicadores. As áreas operacionais continuam disponíveis.</div>}
    <section aria-labelledby="quality-metrics-title"><h2 id="quality-metrics-title" className="sr-only">Indicadores de qualidade</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">{metrics.map((metric) => <Card key={metric.label} className={metric.danger && (metric.value ?? 0) > 0 ? "border-destructive/30" : undefined}><CardContent className="p-4"><div className="flex items-center justify-between"><metric.icon className={metric.danger ? "h-4 w-4 text-destructive" : "h-4 w-4 text-primary"} /><span className="text-xs text-muted-foreground">Agora</span></div>{overview.isLoading ? <Skeleton className="mt-3 h-7 w-14" /> : <p className="mt-2 text-2xl font-bold tabular-nums">{metric.value ?? 0}</p>}<p className="mt-1 text-xs font-medium text-muted-foreground">{metric.label}</p></CardContent></Card>)}</div></section>
    <section aria-labelledby="quality-journey-title"><div className="mb-3"><h2 id="quality-journey-title" className="text-lg font-bold tracking-tight">Jornada operacional</h2><p className="text-sm text-muted-foreground">Cada etapa prepara a próxima e preserva seu histórico.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">{journey.map((item, index) => <Link key={item.route} to={item.route} className="group rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><item.icon className="h-4 w-4" /></span><span className="text-xs font-semibold text-muted-foreground">0{index + 1}</span></div><h3 className="mt-4 text-sm font-semibold">{item.title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p><span className="mt-3 inline-flex items-center text-xs font-medium text-primary">Acessar<ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span></Link>)}</div></section>
  </main>;
}
