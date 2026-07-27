import { useState } from "react";
import { useQualityPermissions } from "../hooks/useQualityPermissions";
import { CheckCircle2, ExternalLink, Play, RotateCcw } from "lucide-react";
import { Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useOrganization } from "@/contexts/OrganizationContext";
import { QUALITY_MANAGEMENT_ENABLED } from "@/lib/featureFlags";
import { useRunActions, useTestRun } from "../hooks/useTestRuns";
import { isTerminalStatus, RUN_ITEM_ACTIVE_STATUSES } from "../utils/qualityRunStatus";

type Step = {
  id: string;
  step_order: number;
  step_snapshot: Record<string, unknown>;
  status: string;
  actual_result: string | null;
};

type Evidence = { id: string; title: string; external_url: string | null };

type Item = {
  id: string;
  status: string;
  test_case_snapshot: Record<string, unknown>;
  quality_test_step_results: Step[];
  quality_test_evidences: Evidence[];
};

type RunData = {
  name: string;
  status: string;
  environment_name: string | null;
  build_reference: string | null;
  quality_test_run_items: Item[];
};

const STEP_STATUSES = ["not_run", "in_progress", "passed", "failed", "blocked", "skipped", "invalid", "retest"] as const;

export default function TestRunPage() {
  const { id } = useParams();
  const { currentOrganizationId } = useOrganization();
  const org = currentOrganizationId ?? "";
  const q = useTestRun(currentOrganizationId, id);
  const a = useRunActions(org, id ?? "");
  const { can } = useQualityPermissions();
  const [actual, setActual] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  if (!QUALITY_MANAGEMENT_ENABLED) return <Navigate to="/sala-agil/dashboard" replace />;
  if (q.isLoading) return <p className="p-12 text-center text-muted-foreground">Carregando runner…</p>;
  if (q.isError || !q.data) return <p role="alert" className="p-12 text-center text-destructive">Execução não encontrada.</p>;

  const run = q.data as typeof q.data & RunData;
  const items = run.quality_test_run_items ?? [];
  const done = items.filter(i => !RUN_ITEM_ACTIVE_STATUSES.includes(i.status as typeof RUN_ITEM_ACTIVE_STATUSES[number])).length;

  const submitReopen = () => {
    if (!reopenReason.trim()) {
      toast.error("Informe o motivo da reabertura.");
      return;
    }
    a.reopen.mutate(reopenReason.trim());
    setReopenDialogOpen(false);
    setReopenReason("");
  };

  return (
    <main className="mx-auto max-w-[1200px] space-y-6 p-4 md:p-8">
      <header className="sticky top-0 z-10 rounded-xl border bg-background/95 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{run.name}</h1>
              <Badge>{run.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {run.environment_name || "Ambiente não informado"} · Progresso {done}/{items.length}
            </p>
          </div>
          <div className="flex gap-2">
            {["draft", "planned"].includes(run.status) && can.canExecute && (
              <Button onClick={() => a.start.mutate()}><Play className="mr-2 h-4 w-4" />Iniciar</Button>
            )}
            {run.status === "in_progress" && can.canExecute && (
              <Button onClick={() => a.complete.mutate(false)}><CheckCircle2 className="mr-2 h-4 w-4" />Concluir</Button>
            )}
            {run.status === "completed" && can.manageTestRuns && (
              <Button variant="outline" onClick={() => setReopenDialogOpen(true)}><RotateCcw className="mr-2 h-4 w-4" />Reabrir</Button>
            )}
          </div>
        </div>
      </header>

      <div className="space-y-5">
        {items.map((item, idx) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {idx + 1}. {(item.test_case_snapshot as Record<string, unknown>)?.title as string ?? "Caso"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {item.quality_test_step_results.map(step => (
                <div key={step.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">Etapa {step.step_order}</span>
                    <div className="flex items-center gap-2">
                      <Select
                        value={step.status}
                        onValueChange={s => a.step.mutate({ id: step.id, status: s, actual: actual[step.id] ?? step.actual_result ?? "" })}
                        disabled={run.status !== "in_progress"}
                      >
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STEP_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Esperado: {step.step_snapshot?.expected_result as string ?? "—"}
                  </div>
                  <div className="mt-2">
                    <Textarea
                      placeholder="Resultado real..."
                      value={actual[step.id] ?? step.actual_result ?? ""}
                      onChange={e => setActual({ ...actual, [step.id]: e.target.value })}
                      disabled={run.status !== "in_progress"}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      placeholder="Título da evidência"
                      value={evidence[step.id] ?? ""}
                      onChange={e => setEvidence({ ...evidence, [step.id]: e.target.value })}
                      disabled={run.status !== "in_progress"}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={run.status !== "in_progress" || !evidence[step.id]?.trim()}
                      onClick={() => {
                        const title = evidence[step.id]?.trim();
                        if (!title) return;
                        a.evidence.mutate({
                          itemId: item.id,
                          stepId: step.id,
                          title,
                          url: `evidence-${Date.now()}`,
                        });
                        setEvidence({ ...evidence, [step.id]: "" });
                        toast.success("Evidência registrada.");
                      }}
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />Anexar
                    </Button>
                  </div>
                  {item.quality_test_evidences.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.quality_test_evidences.map(ev => (
                        <Badge key={ev.id} variant="secondary" className="text-xs">
                          {ev.external_url ? <a href={ev.external_url} target="_blank" rel="noopener noreferrer" className="underline">{ev.title}</a> : ev.title}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir execução</DialogTitle>
            <DialogDescription>Informe o motivo da reabertura desta execução.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reopen-reason">Motivo *</Label>
            <Textarea
              id="reopen-reason"
              value={reopenReason}
              onChange={e => setReopenReason(e.target.value)}
              placeholder="Ex: Novos cenários precisam ser validados..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenDialogOpen(false)}>Cancelar</Button>
            <Button onClick={submitReopen} disabled={!reopenReason.trim()}>Reabrir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
