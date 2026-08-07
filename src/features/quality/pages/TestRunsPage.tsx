import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, PlayCircle, Search } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganization } from "@/contexts/OrganizationContext";
import { QUALITY_MANAGEMENT_ENABLED } from "@/lib/featureFlags";
import { QualityPageSkeleton } from "../components/QualityPageSkeleton";
import { useTestRuns } from "../hooks/useTestRuns";
import { qualityLabel, qualityStatusTone } from "../utils/qualityLabels";

export default function TestRunsPage() {
  const { currentOrganizationId } = useOrganization();
  const runs = useTestRuns(currentOrganizationId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => (runs.data ?? []).filter((run) => {
    const matchesSearch = `${run.name} ${run.environment_name ?? ""} ${run.build_reference ?? ""}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"));
    return matchesSearch && (status === "all" || run.status === status);
  }), [runs.data, search, status]);

  if (!QUALITY_MANAGEMENT_ENABLED) return <Navigate to="/sala-agil/dashboard" replace />;
  const active = runs.data?.filter((run) => ["draft", "planned", "in_progress"].includes(run.status)).length ?? 0;
  const completed = runs.data?.filter((run) => run.status === "completed").length ?? 0;
  const failed = runs.data?.reduce((total, run) => total + run.quality_test_run_items.filter((item) => item.status === "failed").length, 0) ?? 0;

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-6 p-4 md:p-8">
      <header className="border-b pb-6">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-primary"><PlayCircle className="h-4 w-4" /> Operação de qualidade</p>
        <h1 className="text-3xl font-bold tracking-tight">Execuções</h1>
        <p className="mt-1 text-sm text-muted-foreground">Monitore sessões, avance testes manualmente e preserve evidências por etapa.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo das execuções">
        <Summary icon={Clock3} label="Em preparação ou andamento" value={active} />
        <Summary icon={CheckCircle2} label="Concluídas" value={completed} />
        <Summary icon={AlertTriangle} label="Casos com falha" value={failed} danger={failed > 0} />
      </section>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row">
        <div className="relative flex-1"><Label htmlFor="run-search" className="sr-only">Buscar execuções</Label><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="run-search" className="min-h-11 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, ambiente ou build…" /></div>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="min-h-11 sm:w-52" aria-label="Filtrar por status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{["planned", "in_progress", "completed", "cancelled"].map((value) => <SelectItem key={value} value={value}>{qualityLabel(value)}</SelectItem>)}</SelectContent></Select>
      </div>

      {runs.isLoading ? <QualityPageSkeleton rows={5} /> : runs.isError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 p-8 text-center"><p className="font-medium text-destructive">Não foi possível carregar as execuções.</p><Button className="mt-4" variant="outline" onClick={() => runs.refetch()}>Tentar novamente</Button></div>
      ) : filtered.length ? (
        <div className="space-y-3">
          {filtered.map((run) => {
            const total = run.quality_test_run_items.length;
            const done = run.quality_test_run_items.filter((item) => ["passed", "failed", "blocked", "skipped", "invalid"].includes(item.status)).length;
            const percentage = total ? Math.round((done / total) * 100) : 0;
            return <Card key={run.id}><CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-semibold">{run.name}</h2><Badge variant={qualityStatusTone(run.status)}>{qualityLabel(run.status)}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{run.environment_name || "Ambiente não informado"} · Build {run.build_reference || "não informada"} · {new Date(run.created_at).toLocaleString("pt-BR")}</p></div><div><div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">Progresso</span><span className="font-medium tabular-nums">{done}/{total} ({percentage}%)</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percentage}%` }} /></div></div><Button asChild variant={run.status === "in_progress" ? "default" : "outline"} className="min-h-11"><Link to={`/sala-agil/qualidade/execucoes/${run.id}`}>{run.status === "in_progress" ? "Continuar" : "Abrir execução"}</Link></Button></CardContent></Card>;
          })}
        </div>
      ) : <div className="rounded-xl border border-dashed p-12 text-center"><PlayCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium">{runs.data?.length ? "Nenhuma execução corresponde aos filtros" : "Nenhuma execução criada"}</p><p className="mt-1 text-sm text-muted-foreground">{runs.data?.length ? "Ajuste os termos da busca." : "Crie uma execução a partir de um plano versionado."}</p></div>}
    </main>
  );
}

function Summary({ icon: Icon, label, value, danger = false }: { icon: typeof Clock3; label: string; value: number; danger?: boolean }) {
  return <Card className={danger ? "border-destructive/40" : undefined}><CardContent className="flex items-center gap-3 p-4"><span className={`grid h-10 w-10 place-items-center rounded-lg ${danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}><Icon className="h-5 w-5" /></span><div><p className="text-2xl font-bold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>;
}
