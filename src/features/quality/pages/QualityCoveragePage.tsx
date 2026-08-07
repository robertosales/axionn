import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, GitBranch, Search, ShieldCheck } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganization } from "@/contexts/OrganizationContext";
import { QUALITY_MANAGEMENT_ENABLED } from "@/lib/featureFlags";
import { QualityPageSkeleton } from "../components/QualityPageSkeleton";
import { useQualityCoverage } from "../hooks/useQualityCoverage";
import { qualityLabel, qualityStatusTone } from "../utils/qualityLabels";

export default function QualityCoveragePage() {
  const { currentOrganizationId } = useOrganization();
  const coverage = useQualityCoverage(currentOrganizationId);
  const [search, setSearch] = useState("");
  const [gap, setGap] = useState("all");
  const rows = useMemo(() => (coverage.data ?? []).map((item) => {
    const latest = item.quality_test_run_items.slice().sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))[0];
    return { ...item, traceable: item.quality_test_case_links.length > 0, planned: item.quality_test_plan_items.length > 0, executed: item.quality_test_run_items.length > 0, latestStatus: latest?.status ?? "not_run" };
  }), [coverage.data]);
  const filtered = rows.filter((row) => {
    const matches = `${row.code} ${row.title}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"));
    if (!matches || gap === "all") return matches;
    if (gap === "traceability") return !row.traceable;
    if (gap === "planning") return !row.planned;
    if (gap === "execution") return !row.executed;
    return row.latestStatus === "failed" || row.latestStatus === "blocked";
  });
  if (!QUALITY_MANAGEMENT_ENABLED) return <Navigate to="/sala-agil/dashboard" replace />;
  const fullyCovered = rows.filter((row) => row.traceable && row.planned && row.executed).length;
  const rate = rows.length ? Math.round((fullyCovered / rows.length) * 100) : 0;
  const criticalGaps = rows.filter((row) => row.severity === "critical" && (!row.traceable || !row.planned || !row.executed)).length;

  return <main className="mx-auto w-full max-w-[1500px] space-y-6 p-4 md:p-8"><header className="border-b pb-6"><p className="mb-2 flex items-center gap-2 text-sm font-medium text-primary"><GitBranch className="h-4 w-4" /> Matriz viva</p><h1 className="text-3xl font-bold tracking-tight">Cobertura e rastreabilidade</h1><p className="mt-1 text-sm text-muted-foreground">Encontre lacunas entre requisito, caso versionado, planejamento e resultado executado.</p></header>
    <section className="grid gap-3 sm:grid-cols-3"><Metric icon={ShieldCheck} label="Cobertura ponta a ponta" value={`${rate}%`} /><Metric icon={CheckCircle2} label="Casos completamente cobertos" value={String(fullyCovered)} /><Metric icon={AlertTriangle} label="Lacunas críticas" value={String(criticalGaps)} danger={criticalGaps > 0} /></section>
    <div className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_240px]"><div className="relative"><Label htmlFor="coverage-search" className="sr-only">Buscar cobertura</Label><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="coverage-search" className="min-h-11 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar caso…" /></div><Select value={gap} onValueChange={setGap}><SelectTrigger className="min-h-11" aria-label="Filtrar lacunas"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toda a matriz</SelectItem><SelectItem value="traceability">Sem rastreabilidade</SelectItem><SelectItem value="planning">Fora de planos</SelectItem><SelectItem value="execution">Nunca executados</SelectItem><SelectItem value="risk">Falhou ou bloqueado</SelectItem></SelectContent></Select></div>
    {coverage.isLoading ? <QualityPageSkeleton rows={6} /> : coverage.isError ? <div role="alert" className="rounded-xl border border-destructive/30 p-8 text-center text-destructive">Não foi possível montar a matriz de cobertura.</div> : filtered.length ? <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[850px] text-sm"><thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-4 font-medium">Caso</th><th className="p-4 font-medium">Rastreabilidade</th><th className="p-4 font-medium">Planejamento</th><th className="p-4 font-medium">Execução mais recente</th><th className="p-4 font-medium">Risco</th></tr></thead><tbody className="divide-y">{filtered.map((row) => <tr key={row.id} className="bg-card"><td className="p-4"><span className="font-mono text-xs text-primary">{row.code}</span><p className="mt-1 max-w-md font-medium">{row.title}</p></td><td className="p-4"><CoverageBadge covered={row.traceable} yes={`${row.quality_test_case_links.length} vínculo(s)`} no="Sem vínculo" /></td><td className="p-4"><CoverageBadge covered={row.planned} yes={`${row.quality_test_plan_items.length} plano(s)`} no="Fora de planos" /></td><td className="p-4"><Badge variant={qualityStatusTone(row.latestStatus)}>{qualityLabel(row.latestStatus)}</Badge></td><td className="p-4"><Badge variant={qualityStatusTone(row.severity)}>{qualityLabel(row.severity)}</Badge></td></tr>)}</tbody></table></div> : <div className="rounded-xl border border-dashed p-12 text-center"><ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium">Nenhuma linha corresponde aos filtros</p><Button className="mt-4" variant="outline" onClick={() => { setSearch(""); setGap("all"); }}>Limpar filtros</Button></div>}
  </main>;
}

function CoverageBadge({ covered, yes, no }: { covered: boolean; yes: string; no: string }) { return <Badge variant={covered ? "default" : "outline"} className={!covered ? "border-amber-500/50 text-amber-700 dark:text-amber-300" : undefined}>{covered ? yes : no}</Badge>; }
function Metric({ icon: Icon, label, value, danger = false }: { icon: typeof ShieldCheck; label: string; value: string; danger?: boolean }) { return <Card className={danger ? "border-destructive/40" : undefined}><CardContent className="flex items-center gap-3 p-4"><Icon className={`h-5 w-5 ${danger ? "text-destructive" : "text-primary"}`} /><div><p className="text-2xl font-bold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>; }
