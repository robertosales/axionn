import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Layers3,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useOrganization } from "@/contexts/OrganizationContext";
import { QUALITY_MANAGEMENT_ENABLED } from "@/lib/featureFlags";
import { QualityPageSkeleton } from "../components/QualityPageSkeleton";
import { usePlanActions, useTestPlans } from "../hooks/useTestPlans";
import { useQualityPermissions } from "../hooks/useQualityPermissions";
import { useTestCases } from "../hooks/useTestCases";
import type { QualityPlanRow } from "../services/qualityTestPlans.service";
import { qualityLabel, qualityStatusTone } from "../utils/qualityLabels";

interface RunDraft {
  name: string;
  environmentName: string;
  buildReference: string;
  commitSha: string;
}

const emptyRun: RunDraft = { name: "", environmentName: "", buildReference: "", commitSha: "" };

export default function TestPlansPage() {
  const { currentOrganizationId } = useOrganization();
  const org = currentOrganizationId ?? "";
  const navigate = useNavigate();
  const { can } = useQualityPermissions();
  const plans = useTestPlans(currentOrganizationId);
  const cases = useTestCases(currentOrganizationId, "");
  const actions = usePlanActions(org);
  const [selectedPlanId, setSelectedPlanId] = useState<string>();
  const [selectedCaseId, setSelectedCaseId] = useState<string>();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [runOpen, setRunOpen] = useState(false);
  const [runDraft, setRunDraft] = useState<RunDraft>(emptyRun);

  const filteredPlans = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return plans.data ?? [];
    return (plans.data ?? []).filter((plan) =>
      `${plan.name} ${plan.description ?? ""}`.toLocaleLowerCase("pt-BR").includes(term),
    );
  }, [plans.data, search]);

  useEffect(() => {
    if (!selectedPlanId && plans.data?.length) setSelectedPlanId(plans.data[0].id);
    if (selectedPlanId && plans.data && !plans.data.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(plans.data[0]?.id);
    }
  }, [plans.data, selectedPlanId]);

  if (!QUALITY_MANAGEMENT_ENABLED) return <Navigate to="/sala-agil/dashboard" replace />;

  const selectedPlan = plans.data?.find((plan) => plan.id === selectedPlanId);
  const selectedCaseIds = new Set(selectedPlan?.quality_test_plan_items.map((item) => item.test_case_id));
  const availableCases = cases.data?.filter((testCase) => !selectedCaseIds.has(testCase.id)) ?? [];
  const selectedCases = selectedPlan?.quality_test_plan_items
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({ item, testCase: cases.data?.find((testCase) => testCase.id === item.test_case_id) })) ?? [];
  const criticalCount = selectedCases.filter(({ testCase }) => testCase?.severity === "critical").length;
  const highCount = selectedCases.filter(({ testCase }) => testCase?.severity === "high").length;
  const automatedCount = selectedCases.filter(({ testCase }) => testCase?.execution_mode === "automated").length;

  const createPlan = async () => {
    try {
      const id = await actions.create.mutateAsync({
        name: createName.trim(),
        description: createDescription.trim() || null,
        status: "draft",
      });
      setSelectedPlanId(id);
      setCreateName("");
      setCreateDescription("");
      setCreateOpen(false);
      toast.success("Plano criado e pronto para composição.");
    } catch {
      toast.error("Não foi possível criar o plano.");
    }
  };

  const addCase = async () => {
    const testCase = cases.data?.find((item) => item.id === selectedCaseId);
    if (!testCase || !selectedPlan) return;
    try {
      await actions.add.mutateAsync({
        planId: selectedPlan.id,
        caseId: testCase.id,
        version: testCase.current_version,
      });
      setSelectedCaseId(undefined);
      toast.success(`${testCase.code} adicionado na versão ${testCase.current_version}.`);
    } catch {
      toast.error("Não foi possível adicionar o caso.");
    }
  };

  const openRunDialog = (plan: QualityPlanRow) => {
    setRunDraft({ ...emptyRun, name: `${plan.name} — ${new Date().toLocaleDateString("pt-BR")}` });
    setRunOpen(true);
  };

  const createRun = async () => {
    if (!selectedPlan) return;
    try {
      const runId = await actions.run.mutateAsync({
        planId: selectedPlan.id,
        name: runDraft.name.trim(),
        environmentName: runDraft.environmentName.trim(),
        buildReference: runDraft.buildReference.trim(),
        commitSha: runDraft.commitSha.trim(),
      });
      setRunOpen(false);
      toast.success("Execução criada com uma cópia versionada do plano.");
      navigate(`/sala-agil/qualidade/execucoes/${runId}`);
    } catch {
      toast.error("Não foi possível criar a execução.");
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-6 p-4 md:p-8">
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <ClipboardList className="h-4 w-4" /> Preparação e cobertura
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Planos de teste</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Defina o objetivo, congele versões dos casos e envie um pacote reproduzível para execução.
          </p>
        </div>
        {can.manageTestPlans && (
          <Button className="min-h-11" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo plano
          </Button>
        )}
      </header>

      {plans.isLoading || cases.isLoading ? (
        <QualityPageSkeleton rows={6} />
      ) : plans.isError || cases.isError ? (
        <Card className="border-destructive/40">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
            <p className="font-medium">Não foi possível carregar a bancada de planos.</p>
            <Button className="mt-4" variant="outline" onClick={() => void Promise.all([plans.refetch(), cases.refetch()])}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : plans.data?.length ? (
        <div className="grid min-h-[620px] overflow-hidden rounded-xl border bg-card lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border-b bg-muted/20 lg:border-b-0 lg:border-r" aria-label="Lista de planos">
            <div className="border-b p-4">
              <Label className="sr-only" htmlFor="plan-search">Buscar planos</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="plan-search" className="min-h-11 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar planos…" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{filteredPlans.length} de {plans.data.length} planos</p>
            </div>
            <div className="max-h-[560px] overflow-y-auto p-2">
              {filteredPlans.map((plan) => {
                const active = plan.id === selectedPlanId;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => { setSelectedPlanId(plan.id); setSelectedCaseId(undefined); }}
                    className={`mb-1 flex min-h-16 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{plan.name}</p>
                      <p className={`mt-1 text-xs ${active ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                        {plan.quality_test_plan_items.length} caso(s) · {qualityLabel(plan.status)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </button>
                );
              })}
              {!filteredPlans.length && <p className="p-6 text-center text-sm text-muted-foreground">Nenhum plano corresponde à busca.</p>}
            </div>
          </aside>

          {selectedPlan ? (
            <section className="min-w-0 p-4 md:p-6" aria-labelledby="selected-plan-title">
              <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id="selected-plan-title" className="text-xl font-bold">{selectedPlan.name}</h2>
                    <Badge variant={qualityStatusTone(selectedPlan.status)}>{qualityLabel(selectedPlan.status)}</Badge>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                    {selectedPlan.description || "Sem objetivo registrado. Inclua uma descrição ao criar o próximo plano para orientar a execução."}
                  </p>
                </div>
                {can.manageTestPlans && (
                  <Button className="min-h-11 shrink-0" disabled={!selectedCases.length} onClick={() => openRunDialog(selectedPlan)}>
                    <Play className="mr-2 h-4 w-4" /> Criar execução
                  </Button>
                )}
              </div>

              <div className="grid gap-3 py-5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo de cobertura">
                <Metric icon={Layers3} label="Casos congelados" value={selectedCases.length} />
                <Metric icon={AlertTriangle} label="Risco alto/crítico" value={criticalCount + highCount} warning={criticalCount > 0} />
                <Metric icon={ShieldCheck} label="Críticos" value={criticalCount} warning={criticalCount > 0} />
                <Metric icon={CheckCircle2} label="Automatizados" value={automatedCount} />
              </div>

              {can.manageTestPlans && (
                <div className="mb-5 flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label htmlFor="case-picker" className="mb-2 block text-xs">Adicionar caso na versão atual</Label>
                    <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                      <SelectTrigger id="case-picker" className="min-h-11"><SelectValue placeholder="Selecione um caso…" /></SelectTrigger>
                      <SelectContent>
                        {availableCases.map((testCase) => (
                          <SelectItem key={testCase.id} value={testCase.id}>
                            {testCase.code} — {testCase.title} (v{testCase.current_version})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="min-h-11" variant="outline" disabled={!selectedCaseId || actions.add.isPending} onClick={addCase}>Adicionar</Button>
                </div>
              )}

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">Composição versionada</h3>
                  <span className="text-xs text-muted-foreground">Alterações futuras nos casos não afetam esta seleção</span>
                </div>
                {selectedCases.length ? (
                  <ul className="divide-y rounded-lg border">
                    {selectedCases.map(({ item, testCase }, index) => (
                      <li key={item.id} className="flex min-h-16 items-center gap-3 px-3 py-2 md:px-4">
                        <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium"><span className="mr-2 font-mono text-xs text-primary">{testCase?.code ?? "Caso"}</span>{testCase?.title ?? item.test_case_id}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{qualityLabel(testCase?.severity)} · {qualityLabel(testCase?.execution_mode)}</p>
                        </div>
                        <Badge variant="outline">v{item.test_case_version}</Badge>
                        {can.manageTestPlans && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="min-h-11 min-w-11"
                            aria-label={`Remover ${testCase?.code ?? "caso"} do plano`}
                            disabled={actions.remove.isPending}
                            onClick={async () => {
                              try {
                                await actions.remove.mutateAsync({ planId: selectedPlan.id, caseId: item.test_case_id });
                                toast.success("Caso removido do plano. O caso original foi preservado.");
                              } catch { toast.error("Não foi possível remover o caso do plano."); }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-lg border border-dashed p-10 text-center">
                    <Layers3 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="font-medium">Este plano ainda não possui casos</p>
                    <p className="mt-1 text-sm text-muted-foreground">Adicione casos para calcular cobertura e liberar a criação da execução.</p>
                  </div>
                )}
              </div>
            </section>
          ) : <div className="grid place-items-center p-10 text-sm text-muted-foreground">Selecione um plano para trabalhar.</div>}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Nenhum plano criado</p>
          <p className="mt-1 text-sm text-muted-foreground">Comece pelo objetivo e depois componha a cobertura.</p>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo plano de teste</DialogTitle>
            <DialogDescription>Registre o objetivo. Cada caso adicionado ficará vinculado à versão atual.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="plan-name">Nome</Label><Input id="plan-name" autoFocus value={createName} onChange={(event) => setCreateName(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="plan-description">Objetivo e escopo</Label><Textarea id="plan-description" rows={4} value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} placeholder="O que deve ser validado e qual risco este plano cobre?" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button disabled={!createName.trim() || actions.create.isPending} onClick={createPlan}>Criar plano</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar execução</DialogTitle>
            <DialogDescription>Será criada uma cópia imutável dos {selectedCases.length} casos e versões deste plano.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="run-name">Nome da execução</Label><Input id="run-name" autoFocus value={runDraft.name} onChange={(event) => setRunDraft((draft) => ({ ...draft, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="run-environment">Ambiente</Label><Input id="run-environment" value={runDraft.environmentName} onChange={(event) => setRunDraft((draft) => ({ ...draft, environmentName: event.target.value }))} placeholder="Homologação" /></div>
            <div className="space-y-2"><Label htmlFor="run-build">Build / versão</Label><Input id="run-build" value={runDraft.buildReference} onChange={(event) => setRunDraft((draft) => ({ ...draft, buildReference: event.target.value }))} placeholder="v2.14.0" /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="run-commit">Commit (opcional)</Label><Input id="run-commit" value={runDraft.commitSha} onChange={(event) => setRunDraft((draft) => ({ ...draft, commitSha: event.target.value }))} placeholder="SHA do commit validado" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRunOpen(false)}>Cancelar</Button><Button disabled={!runDraft.name.trim() || !runDraft.environmentName.trim() || !runDraft.buildReference.trim() || actions.run.isPending} onClick={createRun}>Criar e abrir execução</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Metric({ icon: Icon, label, value, warning = false }: { icon: typeof Layers3; label: string; value: number; warning?: boolean }) {
  return (
    <Card className={warning ? "border-destructive/40" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${warning ? "text-destructive" : "text-primary"}`} />
      </CardHeader>
      <CardContent className="px-4 pb-4 text-2xl font-bold tabular-nums">{value}</CardContent>
    </Card>
  );
}
