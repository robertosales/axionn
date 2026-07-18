import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { qualityTestCaseSchema } from "../schemas/testCase.schema";
import { getTestCase } from "../services/qualityTestCases.service";
import { useSaveTestCase } from "../hooks/useTestCases";

type Step = { action: string; input_data: string; expected_result: string; reference_url: string };
const emptyStep = (): Step => ({ action: "", input_data: "", expected_result: "", reference_url: "" });

export function TestCaseFormDialog({ organizationId, caseId, open, onOpenChange }: { organizationId: string; caseId?: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [preconditions, setPreconditions] = useState("");
  const [postconditions, setPostconditions] = useState("");
  const [testData, setTestData] = useState("");
  const [testType, setTestType] = useState("functional");
  const [priority, setPriority] = useState("medium");
  const [severity, setSeverity] = useState("medium");
  const [status, setStatus] = useState<string>("draft");
  const [executionMode, setExecutionMode] = useState<string>("manual");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [tags, setTags] = useState("");
  const [steps, setSteps] = useState<Step[]>([emptyStep()]);
  const [loading, setLoading] = useState(false);
  const save = useSaveTestCase(organizationId);

  useEffect(() => {
    if (!open) return;
    if (!caseId) {
      setTitle(""); setObjective(""); setPreconditions(""); setPostconditions("");
      setTestData(""); setTestType("functional"); setPriority("medium"); setSeverity("medium");
      setStatus("draft"); setExecutionMode("manual"); setEstimatedMinutes(""); setTags("");
      setSteps([emptyStep()]);
      return;
    }
    setLoading(true);
    getTestCase(organizationId, caseId)
      .then(c => {
        setTitle(c.title);
        setObjective(c.objective ?? "");
        setPreconditions(c.preconditions ?? "");
        setPostconditions(c.postconditions ?? "");
        setTestData(c.test_data ?? "");
        setTestType(c.test_type);
        setPriority(c.priority);
        setSeverity(c.severity);
        setStatus(c.status);
        setExecutionMode(c.execution_mode);
        setEstimatedMinutes(c.estimated_minutes?.toString() ?? "");
        setTags(c.tags?.join(", ") ?? "");
        setSteps(c.quality_test_steps.map(s => ({
          action: s.action,
          input_data: s.input_data ?? "",
          expected_result: s.expected_result,
          reference_url: s.reference_url ?? "",
        })));
      })
      .catch(() => toast.error("Não foi possível carregar o caso."))
      .finally(() => setLoading(false));
  }, [caseId, open, organizationId]);

  const submit = async () => {
    const parsedTags = tags.split(",").map(t => t.trim()).filter(Boolean);
    const payload = {
      organizationId,
      title,
      objective: objective || null,
      preconditions: preconditions || null,
      postconditions: postconditions || null,
      testData: testData || null,
      testType,
      priority,
      severity,
      status: caseId ? status : "draft",
      executionMode: caseId ? executionMode : "manual",
      estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
      tags: parsedTags,
      steps: steps.map(s => ({
        action: s.action,
        inputData: s.input_data || null,
        expectedResult: s.expected_result,
        referenceUrl: s.reference_url || null,
      })),
    };
    const parsed = qualityTestCaseSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error("Revise o título e as etapas obrigatórias.");
      return;
    }
    const dbPayload = {
      title: parsed.data.title,
      objective: parsed.data.objective,
      preconditions: parsed.data.preconditions,
      postconditions: parsed.data.postconditions,
      test_data: parsed.data.testData,
      test_type: parsed.data.testType,
      priority: parsed.data.priority,
      severity: parsed.data.severity,
      status: parsed.data.status,
      execution_mode: parsed.data.executionMode,
      estimated_minutes: parsed.data.estimatedMinutes,
      tags: parsed.data.tags,
      steps,
    };
    try {
      await save.mutateAsync({ id: caseId, payload: dbPayload });
      toast.success(caseId ? "Caso atualizado." : "Caso criado.");
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar o caso.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{caseId ? "Editar caso de teste" : "Novo caso de teste"}</DialogTitle>
          <DialogDescription>Defina o propósito e uma sequência verificável de ações.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="quality-title">Título *</Label>
                <Input id="quality-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={300} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="quality-objective">Objetivo</Label>
                <Textarea id="quality-objective" value={objective} onChange={e => setObjective(e.target.value)} />
              </div>
              {caseId && (
                <>
                  <div className="space-y-2">
                    <Label>Pré-condições</Label>
                    <Textarea value={preconditions} onChange={e => setPreconditions(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Pós-condições</Label>
                    <Textarea value={postconditions} onChange={e => setPostconditions(e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Dados de teste</Label>
                    <Textarea value={testData} onChange={e => setTestData(e.target.value)} />
                  </div>
                </>
              )}
              {[
                ["Tipo", testType, setTestType, ["functional", "regression", "integration", "api", "security", "accessibility", "uat", "other"]],
                ["Prioridade", priority, setPriority, ["low", "medium", "high", "critical"]],
                ["Severidade", severity, setSeverity, ["low", "medium", "high", "critical"]],
              ].map(([label, value, setter, options]) => (
                <div className="space-y-2" key={label as string}>
                  <Label>{label as string}</Label>
                  <Select value={value as string} onValueChange={setter as (v: string) => void}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(options as string[]).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              {caseId && (
                <>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["draft", "ready", "approved", "deprecated"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Modo de execução</Label>
                    <Select value={executionMode} onValueChange={setExecutionMode}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["manual", "automated", "hybrid"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tempo estimado (min)</Label>
                    <Input type="number" min="0" value={estimatedMinutes} onChange={e => setEstimatedMinutes(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tags (separadas por vírgula)</Label>
                    <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="ex: smoke, regressão" />
                  </div>
                </>
              )}
            </div>
            <fieldset className="space-y-3">
              <div className="flex items-center justify-between">
                <legend className="font-semibold">Etapas</legend>
                <Button type="button" variant="outline" size="sm" onClick={() => setSteps([...steps, emptyStep()])}>
                  <Plus className="mr-2 h-4 w-4" />Adicionar etapa
                </Button>
              </div>
              {steps.map((step, index) => (
                <div key={index} className="rounded-lg border bg-muted/20 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold">Etapa {index + 1}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSteps(steps.filter((_, i) => i !== index))} disabled={steps.length <= 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Ação *</Label>
                      <Textarea value={step.action} onChange={e => { const s = [...steps]; s[index] = { ...s[index], action: e.target.value }; setSteps(s); }} />
                    </div>
                    <div className="space-y-2">
                      <Label>Dados de entrada</Label>
                      <Textarea value={step.input_data} onChange={e => { const s = [...steps]; s[index] = { ...s[index], input_data: e.target.value }; setSteps(s); }} />
                    </div>
                    <div className="space-y-2">
                      <Label>Resultado esperado *</Label>
                      <Textarea value={step.expected_result} onChange={e => { const s = [...steps]; s[index] = { ...s[index], expected_result: e.target.value }; setSteps(s); }} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>URL de referência</Label>
                      <Input value={step.reference_url} onChange={e => { const s = [...steps]; s[index] = { ...s[index], reference_url: e.target.value }; setSteps(s); }} placeholder="https://..." />
                    </div>
                  </div>
                </div>
              ))}
            </fieldset>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading || !title.trim() || steps.length === 0}>{caseId ? "Salvar" : "Criar caso"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
