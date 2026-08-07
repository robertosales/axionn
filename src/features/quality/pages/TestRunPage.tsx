import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bug, CheckCircle2, ExternalLink, Play, RotateCcw, Save, ShieldAlert } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOrganization } from "@/contexts/OrganizationContext";
import { QUALITY_MANAGEMENT_ENABLED } from "@/lib/featureFlags";
import { safeExternalUrl } from "@/lib/security";
import { QualityPageSkeleton } from "../components/QualityPageSkeleton";
import { CreateFindingDialog, type FindingContext } from "../components/CreateFindingDialog";
import { useQualityPermissions } from "../hooks/useQualityPermissions";
import { useRunActions, useTestRun } from "../hooks/useTestRuns";
import { qualityLabel, qualityStatusTone } from "../utils/qualityLabels";
import { RUN_ITEM_ACTIVE_STATUSES } from "../utils/qualityRunStatus";

type Step = { id: string; step_order: number; step_snapshot: Record<string, unknown>; status: string; actual_result: string | null };
type Evidence = { id: string; step_result_id: string | null; title: string; external_url: string | null };
type Item = { id: string; status: string; test_case_snapshot: Record<string, unknown>; quality_test_step_results: Step[]; quality_test_evidences: Evidence[] };
type RunData = { name: string; status: string; environment_name: string | null; build_reference: string | null; commit_sha: string | null; quality_test_run_items: Item[] };
type EvidenceDraft = { title: string; url: string };

const STEP_STATUSES = ["not_run", "in_progress", "passed", "failed", "blocked", "skipped", "invalid", "retest"] as const;

export default function TestRunPage() {
  const { id } = useParams();
  const { currentOrganizationId } = useOrganization();
  const org = currentOrganizationId ?? "";
  const runQuery = useTestRun(currentOrganizationId, id);
  const actions = useRunActions(org, id ?? "");
  const { can } = useQualityPermissions();
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const [actual, setActual] = useState<Record<string, string>>({});
  const [stepStatus, setStepStatus] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<Record<string, EvidenceDraft>>({});
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [findingContext, setFindingContext] = useState<FindingContext | null>(null);

  const run = runQuery.data as (typeof runQuery.data & RunData) | undefined;
  const items = useMemo(() => run?.quality_test_run_items ?? [], [run]);
  useEffect(() => { if (!selectedItemId && items.length) setSelectedItemId(items[0].id); }, [items, selectedItemId]);

  if (!QUALITY_MANAGEMENT_ENABLED) return <Navigate to="/sala-agil/dashboard" replace />;
  if (runQuery.isLoading) return <main className="mx-auto max-w-[1500px] p-4 md:p-8"><QualityPageSkeleton rows={6} /></main>;
  if (runQuery.isError || !run) return <main className="p-12 text-center"><p role="alert" className="text-destructive">Execução não encontrada ou sem acesso.</p><Button asChild className="mt-4" variant="outline"><Link to="/sala-agil/qualidade/execucoes">Voltar às execuções</Link></Button></main>;

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0];
  const done = items.filter((item) => !RUN_ITEM_ACTIVE_STATUSES.includes(item.status as typeof RUN_ITEM_ACTIVE_STATUSES[number])).length;
  const pending = items.length - done;
  const percentage = items.length ? Math.round((done / items.length) * 100) : 0;
  const editable = run.status === "in_progress" && can.canExecute;

  const saveStep = async (step: Step) => {
    try {
      await actions.step.mutateAsync({ id: step.id, status: stepStatus[step.id] ?? step.status, actual: actual[step.id] ?? step.actual_result ?? "" });
      toast.success(`Etapa ${step.step_order} salva.`);
    } catch { toast.error("Não foi possível salvar o resultado da etapa."); }
  };

  const addEvidence = async (item: Item, step: Step) => {
    const draft = evidence[step.id];
    if (!draft?.title.trim() || !safeExternalUrl(draft.url)) return;
    try {
      await actions.evidence.mutateAsync({ itemId: item.id, stepId: step.id, title: draft.title.trim(), url: draft.url.trim() });
      setEvidence((current) => ({ ...current, [step.id]: { title: "", url: "" } }));
      toast.success("Evidência vinculada à etapa.");
    } catch { toast.error("Não foi possível registrar a evidência."); }
  };

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 p-4 md:p-8">
      <header className="sticky top-2 z-10 rounded-xl border bg-background/95 p-4 shadow-sm backdrop-blur md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <Button asChild variant="link" className="mb-1 h-auto p-0 text-muted-foreground"><Link to="/sala-agil/qualidade/execucoes"><ArrowLeft className="mr-1 h-4 w-4" /> Execuções</Link></Button>
            <div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-2xl font-bold">{run.name}</h1><Badge variant={qualityStatusTone(run.status)}>{qualityLabel(run.status)}</Badge></div>
            <p className="mt-1 text-sm text-muted-foreground">{run.environment_name || "Ambiente não informado"} · Build {run.build_reference || "não informada"}{run.commit_sha ? ` · ${run.commit_sha.slice(0, 8)}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["draft", "planned"].includes(run.status) && can.canExecute && <Button className="min-h-11" disabled={actions.start.isPending} onClick={async () => { try { await actions.start.mutateAsync(); toast.success("Execução iniciada."); } catch { toast.error("Não foi possível iniciar a execução."); } }}><Play className="mr-2 h-4 w-4" /> Iniciar</Button>}
            {run.status === "in_progress" && can.canExecute && <Button className="min-h-11" onClick={() => setCompleteOpen(true)}><CheckCircle2 className="mr-2 h-4 w-4" /> Concluir</Button>}
            {run.status === "completed" && can.manageTestRuns && <Button className="min-h-11" variant="outline" onClick={() => setReopenOpen(true)}><RotateCcw className="mr-2 h-4 w-4" /> Reabrir</Button>}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percentage}%` }} /></div><span className="text-xs font-medium tabular-nums">{done}/{items.length} · {percentage}%</span></div>
      </header>

      <div className="grid min-h-[620px] overflow-hidden rounded-xl border bg-card lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b bg-muted/20 p-2 lg:border-b-0 lg:border-r" aria-label="Casos desta execução">
          <div className="px-3 py-3"><h2 className="font-semibold">Roteiro da execução</h2><p className="text-xs text-muted-foreground">Snapshots preservados do plano</p></div>
          <div className="max-h-[620px] overflow-y-auto">
            {items.map((item, index) => {
              const snapshot = item.test_case_snapshot;
              const active = item.id === selectedItem?.id;
              return <button key={item.id} type="button" className={`mb-1 flex min-h-16 w-full items-center gap-3 rounded-lg p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} onClick={() => setSelectedItemId(item.id)} aria-current={active ? "step" : undefined}><span className="text-xs tabular-nums">{index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{String(snapshot.code ?? "Caso")} · {String(snapshot.title ?? "Sem título")}</span><span className={`mt-1 block text-xs ${active ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{qualityLabel(item.status)}</span></span></button>;
            })}
          </div>
        </aside>

        {selectedItem ? <section className="min-w-0 p-4 md:p-6" aria-label="Detalhes do caso selecionado">
          <div className="border-b pb-5"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-primary">{String(selectedItem.test_case_snapshot.code ?? "Caso")}</span><Badge variant={qualityStatusTone(selectedItem.status)}>{qualityLabel(selectedItem.status)}</Badge></div><h2 className="mt-2 text-xl font-bold">{String(selectedItem.test_case_snapshot.title ?? "Caso sem título")}</h2>{selectedItem.test_case_snapshot.objective ? <p className="mt-2 text-sm text-muted-foreground">{String(selectedItem.test_case_snapshot.objective)}</p> : null}</div>
          <div className="mt-5 space-y-4">
            {selectedItem.quality_test_step_results.length ? selectedItem.quality_test_step_results.slice().sort((a, b) => a.step_order - b.step_order).map((step) => {
              const snapshot = step.step_snapshot;
              const stepEvidence = selectedItem.quality_test_evidences.filter((item) => item.step_result_id === step.id);
              const draft = evidence[step.id] ?? { title: "", url: "" };
              return <Card key={step.id}><CardContent className="space-y-4 p-4 md:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Etapa {step.step_order}</p><p className="mt-1 font-medium">{String(snapshot.action ?? "Ação não informada")}</p></div><Select value={stepStatus[step.id] ?? step.status} onValueChange={(value) => setStepStatus((current) => ({ ...current, [step.id]: value }))} disabled={!editable}><SelectTrigger className="min-h-11 sm:w-44" aria-label={`Status da etapa ${step.step_order}`}><SelectValue /></SelectTrigger><SelectContent>{STEP_STATUSES.map((value) => <SelectItem key={value} value={value}>{qualityLabel(value)}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-3 rounded-lg bg-muted/40 p-3 text-sm md:grid-cols-2"><div><p className="text-xs font-medium text-muted-foreground">Dados de entrada</p><p className="mt-1 whitespace-pre-wrap">{String(snapshot.input_data ?? "Não informado")}</p></div><div><p className="text-xs font-medium text-muted-foreground">Resultado esperado</p><p className="mt-1 whitespace-pre-wrap">{String(snapshot.expected_result ?? "Não informado")}</p></div></div>
                <div className="space-y-2"><Label htmlFor={`actual-${step.id}`}>Resultado observado</Label><Textarea id={`actual-${step.id}`} rows={3} value={actual[step.id] ?? step.actual_result ?? ""} onChange={(event) => setActual((current) => ({ ...current, [step.id]: event.target.value }))} disabled={!editable} placeholder="Descreva objetivamente o comportamento observado…" /></div>
                {editable && <div className="flex flex-wrap justify-end gap-2">{step.status === "failed" && can.manageQualityFindings && <Button className="min-h-11" variant="outline" onClick={() => setFindingContext({ runItemId: selectedItem.id, stepResultId: step.id, caseTitle: String(selectedItem.test_case_snapshot.title ?? "Caso"), action: String(snapshot.action ?? "Etapa"), expectedResult: String(snapshot.expected_result ?? ""), actualResult: actual[step.id] ?? step.actual_result ?? "" })}><Bug className="mr-2 h-4 w-4" /> Registrar achado</Button>}<Button className="min-h-11" variant="outline" disabled={actions.step.isPending} onClick={() => saveStep(step)}><Save className="mr-2 h-4 w-4" /> Salvar etapa</Button></div>}
                <div className="border-t pt-4"><p className="mb-2 text-sm font-medium">Evidências externas</p>{editable && <div className="grid gap-2 md:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)_auto]"><div><Label className="sr-only" htmlFor={`evidence-title-${step.id}`}>Título da evidência</Label><Input id={`evidence-title-${step.id}`} className="min-h-11" placeholder="Título da evidência" value={draft.title} onChange={(event) => setEvidence((current) => ({ ...current, [step.id]: { ...draft, title: event.target.value } }))} /></div><div><Label className="sr-only" htmlFor={`evidence-url-${step.id}`}>URL da evidência</Label><Input id={`evidence-url-${step.id}`} className="min-h-11" type="url" placeholder="https://…" value={draft.url} onChange={(event) => setEvidence((current) => ({ ...current, [step.id]: { ...draft, url: event.target.value } }))} /></div><Button className="min-h-11" variant="outline" disabled={!draft.title.trim() || !safeExternalUrl(draft.url) || actions.evidence.isPending} onClick={() => addEvidence(selectedItem, step)}><ExternalLink className="mr-2 h-4 w-4" /> Vincular</Button></div>}
                  {stepEvidence.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{stepEvidence.map((item) => { const url = safeExternalUrl(item.external_url); return <li key={item.id}><Badge variant="secondary">{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">{item.title}<ExternalLink className="h-3 w-3" /></a> : item.title}</Badge></li>; })}</ul>}
                </div>
              </CardContent></Card>;
            }) : <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">Este caso não possui etapas no snapshot.</div>}
          </div>
        </section> : <div className="grid place-items-center p-10 text-sm text-muted-foreground">Nenhum caso disponível.</div>}
      </div>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}><DialogContent><DialogHeader><DialogTitle>Concluir execução</DialogTitle><DialogDescription>{pending ? `Ainda existem ${pending} caso(s) pendente(s). Você pode voltar ao roteiro ou concluir registrando explicitamente essa exceção.` : "Todos os casos possuem um resultado terminal. Confirme o encerramento da execução."}</DialogDescription></DialogHeader>{pending > 0 && <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"><ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" /><p>Casos não executados reduzem a confiabilidade do resultado e permanecerão visíveis na auditoria.</p></div>}<DialogFooter><Button variant="outline" onClick={() => setCompleteOpen(false)}>Voltar ao roteiro</Button><Button disabled={actions.complete.isPending} onClick={async () => { try { await actions.complete.mutateAsync(pending > 0); setCompleteOpen(false); toast.success("Execução concluída."); } catch { toast.error("Não foi possível concluir a execução."); } }}>Concluir {pending > 0 ? "com pendências" : "execução"}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}><DialogContent><DialogHeader><DialogTitle>Reabrir execução</DialogTitle><DialogDescription>A justificativa ficará associada ao evento de auditoria.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="reopen-reason">Motivo *</Label><Textarea id="reopen-reason" value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder="Explique o novo risco ou cenário que exige reexecução…" /></div><DialogFooter><Button variant="outline" onClick={() => setReopenOpen(false)}>Cancelar</Button><Button disabled={!reopenReason.trim() || actions.reopen.isPending} onClick={async () => { try { await actions.reopen.mutateAsync(reopenReason.trim()); setReopenReason(""); setReopenOpen(false); toast.success("Execução reaberta."); } catch { toast.error("Não foi possível reabrir a execução."); } }}>Reabrir</Button></DialogFooter></DialogContent></Dialog>
      <CreateFindingDialog orgId={org} context={findingContext} open={Boolean(findingContext)} onOpenChange={(open) => { if (!open) setFindingContext(null); }} />
    </main>
  );
}
