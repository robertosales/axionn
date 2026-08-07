import { useMemo, useState } from "react";
import { AlertTriangle, Bug, CheckCircle2, ExternalLink, Search } from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganization } from "@/contexts/OrganizationContext";
import { QUALITY_MANAGEMENT_ENABLED } from "@/lib/featureFlags";
import { safeExternalUrl } from "@/lib/security";
import { QualityPageSkeleton } from "../components/QualityPageSkeleton";
import { useFindingActions, useQualityFindings } from "../hooks/useQualityFindings";
import { useQualityPermissions } from "../hooks/useQualityPermissions";
import { qualityLabel, qualityStatusTone } from "../utils/qualityLabels";

const findingStatuses = ["open", "triaged", "in_progress", "resolved", "closed", "rejected"];

export default function QualityFindingsPage() {
  const { currentOrganizationId } = useOrganization();
  const org = currentOrganizationId ?? "";
  const findings = useQualityFindings(currentOrganizationId);
  const actions = useFindingActions(org);
  const { can } = useQualityPermissions();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [severity, setSeverity] = useState("all");

  const filtered = useMemo(() => (findings.data ?? []).filter((finding) => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const textMatch = `${finding.code} ${finding.title} ${finding.description ?? ""}`.toLocaleLowerCase("pt-BR").includes(term);
    const statusMatch = status === "all" || (status === "active" ? !["closed", "rejected"].includes(finding.status) : finding.status === status);
    return textMatch && statusMatch && (severity === "all" || finding.severity === severity);
  }), [findings.data, search, severity, status]);

  if (!QUALITY_MANAGEMENT_ENABLED) return <Navigate to="/sala-agil/dashboard" replace />;
  const open = findings.data?.filter((item) => !["resolved", "closed", "rejected"].includes(item.status)).length ?? 0;
  const critical = findings.data?.filter((item) => item.severity === "critical" && !["closed", "rejected"].includes(item.status)).length ?? 0;
  const resolved = findings.data?.filter((item) => ["resolved", "closed"].includes(item.status)).length ?? 0;

  return <main className="mx-auto w-full max-w-[1500px] space-y-5 px-4 pb-8 pt-5 md:px-8 md:pt-6">
    <header className="border-b pb-5"><p className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary"><Bug className="h-4 w-4" /> Risco rastreável</p><h1 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">Achados de qualidade</h1><p className="mt-1 text-sm text-muted-foreground">Transforme resultados inesperados em um fluxo auditável de triagem e resolução.</p></header>
    <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo dos achados"><Metric icon={Bug} label="Em tratamento" value={open} /><Metric icon={AlertTriangle} label="Críticos ativos" value={critical} danger={critical > 0} /><Metric icon={CheckCircle2} label="Resolvidos ou fechados" value={resolved} /></section>
    <div className="grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-[minmax(0,1fr)_200px_180px]"><div className="relative"><Label className="sr-only" htmlFor="finding-search">Buscar achados</Label><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="finding-search" className="min-h-11 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar código, título ou descrição…" /></div><Select value={status} onValueChange={setStatus}><SelectTrigger className="min-h-11" aria-label="Filtrar status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Ativos</SelectItem><SelectItem value="all">Todos os status</SelectItem>{findingStatuses.map((value) => <SelectItem key={value} value={value}>{qualityLabel(value)}</SelectItem>)}</SelectContent></Select><Select value={severity} onValueChange={setSeverity}><SelectTrigger className="min-h-11" aria-label="Filtrar severidade"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as severidades</SelectItem>{["low", "medium", "high", "critical"].map((value) => <SelectItem key={value} value={value}>{qualityLabel(value)}</SelectItem>)}</SelectContent></Select></div>
    {findings.isLoading ? <QualityPageSkeleton rows={5} /> : findings.isError ? <div role="alert" className="rounded-xl border border-destructive/30 p-8 text-center text-destructive">Não foi possível carregar os achados.</div> : filtered.length ? <div className="space-y-3">{filtered.map((finding) => <Card key={finding.id}><CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_180px]"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-semibold text-primary">{finding.code}</span><Badge variant={qualityStatusTone(finding.severity)}>{qualityLabel(finding.severity)}</Badge><Badge variant={qualityStatusTone(finding.status)}>{qualityLabel(finding.status)}</Badge></div><h2 className="mt-2 font-semibold">{finding.title}</h2>{finding.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{finding.description}</p>}<div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground"><span>Criado em {new Date(finding.created_at).toLocaleString("pt-BR")}</span>{finding.test_run_id && <span>Vinculado a uma execução</span>}{safeExternalUrl(finding.external_issue_url) && <a className="inline-flex items-center gap-1 underline" href={safeExternalUrl(finding.external_issue_url)!} target="_blank" rel="noopener noreferrer">Issue externa <ExternalLink className="h-3 w-3" /></a>}</div></div>{can.manageQualityFindings ? <div><Label className="mb-2 block text-xs" htmlFor={`finding-status-${finding.id}`}>Atualizar situação</Label><Select value={finding.status} onValueChange={async (next) => { try { await actions.status.mutateAsync({ id: finding.id, status: next }); toast.success(`${finding.code} atualizado.`); } catch { toast.error("Não foi possível atualizar o achado."); } }}><SelectTrigger id={`finding-status-${finding.id}`} className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{findingStatuses.map((value) => <SelectItem key={value} value={value}>{qualityLabel(value)}</SelectItem>)}</SelectContent></Select></div> : null}</CardContent></Card>)}</div> : <div className="rounded-xl border border-dashed p-12 text-center"><Bug className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium">Nenhum achado corresponde aos filtros</p><p className="mt-1 text-sm text-muted-foreground">Achados podem ser registrados diretamente em uma etapa com falha.</p></div>}
  </main>;
}

function Metric({ icon: Icon, label, value, danger = false }: { icon: typeof Bug; label: string; value: number; danger?: boolean }) {
  return <Card className={danger ? "border-destructive/40" : undefined}><CardContent className="flex items-center gap-3 p-4"><Icon className={`h-5 w-5 ${danger ? "text-destructive" : "text-primary"}`} /><div><p className="text-2xl font-bold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>;
}
