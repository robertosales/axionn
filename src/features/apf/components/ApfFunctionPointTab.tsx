import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle, AlertTriangle, CheckCircle2, Database, Loader2, RefreshCw, Sparkles,
} from "lucide-react";
import { LearningInsightsPanel } from "./learning/LearningInsightsPanel";
import { useLearningInsights } from "../hooks/useLearningInsights";
import { useContractualApfCounting } from "../hooks/useContractualApfCounting";
import { CORRECTION_REASONS, CorrectionReason } from "../types/contractualApf.constants";
import type { CountingDecision, ElementaryProcessRole } from "../utils/elementaryProcess";
import { calculatePfFs, effectiveFactor, effectiveFunction } from "../utils/contractualApf.helpers";

export function ApfFunctionPointTab() {
  const counting = useContractualApfCounting();
  const { insights, loading: insightsLoading, lastRefresh, refresh } = useLearningInsights();

  return (
    <div className="space-y-5">
      <LearningInsightsPanel
        insights={insights}
        loading={insightsLoading}
        lastRefresh={lastRefresh}
        onRefresh={refresh}
      />

      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Select value={counting.projectId} onValueChange={counting.setProjectId}>
              <SelectTrigger><SelectValue placeholder="Projeto" /></SelectTrigger>
              <SelectContent>
                {counting.projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={counting.selectedSprintId} onValueChange={counting.setSelectedSprintId}>
              <SelectTrigger><SelectValue placeholder="Sprint" /></SelectTrigger>
              <SelectContent>
                {counting.sprints.map((sprint) => (
                  <SelectItem key={sprint.id} value={sprint.id}>{sprint.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {counting.context ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <Database className="h-4 w-4" />
              <strong>Baseline ativa:</strong>
              {counting.context.baseline.version} — {counting.context.baseline.label
                ?? counting.context.baseline.source_file_name ?? "sem descrição"}
              <Badge variant="outline">{counting.context.baseline_item_count} itens</Badge>
              <Badge variant="outline">{counting.context.model.standard}</Badge>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <span>{counting.contextError ?? "Importe e ative uma baseline para o projeto antes de contar."}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="HUs (gatilhos)" value={counting.stories.length} />
        <Kpi label="PF Bruto" value={counting.totals.pfBruto.toFixed(2)} />
        <Kpi label="PF Simples (PF FS)" value={counting.totals.pfFs.toFixed(2)} primary />
        <Kpi label="Validadas" value={counting.totals.validated} success />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Impactos por HU e processos elementares</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              A HU é o gatilho. O PF é atribuído somente às EFs que representam processo elementar único, completo e independente.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={counting.loadStories} disabled={counting.loading}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={counting.countAll}
              disabled={!counting.context || counting.countingAll || !counting.stories.length}
              className="gap-2"
            >
              {counting.countingAll
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Sparkles className="h-4 w-4" />}
              Calcular sprint
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {counting.loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Processo elementar</TableHead>
                  <TableHead className="text-center">Tipo / Impacto</TableHead>
                  <TableHead className="text-right">PF Bruto</TableHead>
                  <TableHead className="text-right">PF Simples</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {counting.stories.map((story) => {
                  const typeSummary = story._items.length
                    ? story._items.map((item) => `${effectiveFunction(item)}/${effectiveFactor(item)}`).join(" · ")
                    : "—";
                  const processes = story._items.length
                    ? [...new Map(story._items.map((item) => [
                      item.elementary_process_key ?? item.id,
                      item,
                    ])).values()]
                    : [];
                  const hasReview = story._items.some((item) => item.counting_decision === "review_required");
                  return (
                    <TableRow key={story.id}>
                      <TableCell className="font-mono text-xs">{story.code}</TableCell>
                      <TableCell className="max-w-[280px] text-sm">{story.title}</TableCell>
                      <TableCell className="max-w-[300px]">
                        {processes.length ? (
                          <div className="space-y-1">
                            {processes.map((item) => (
                              <div key={item.elementary_process_key ?? item.id} className="flex items-center gap-1 text-xs">
                                <ProcessDecisionBadge decision={item.counting_decision ?? "counted"} />
                                <span className="truncate" title={item.elementary_process_name ?? item.ef_description}>
                                  {item.elementary_process_name ?? item.ef_description}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-center"><Badge variant="outline">{typeSummary}</Badge></TableCell>
                      <TableCell className="text-right">
                        {story.apf_pf_bruto == null ? "—" : Number(story.apf_pf_bruto).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {story.apf_pf_fs == null ? "—" : Number(story.apf_pf_fs).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasReview ? (
                          <Badge className="bg-amber-100 text-amber-800">
                            <AlertTriangle className="mr-1 h-3 w-3" />Revisar processo
                          </Badge>
                        ) : story.ai_fp_validated ? (
                          <Badge className="bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="mr-1 h-3 w-3" />Validado
                          </Badge>
                        ) : story._error ? (
                          <Badge variant="destructive" title={story._error}>
                            <AlertCircle className="mr-1 h-3 w-3" />Erro
                          </Badge>
                        ) : story._items.length ? (
                          <Badge variant="outline">Calculado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {story._loading ? <Loader2 className="ml-auto h-4 w-4 animate-spin" /> : story._items.length ? (
                          <Button size="sm" variant={hasReview ? "default" : "ghost"} onClick={() => counting.openValidation(story)}>
                            {hasReview ? "Resolver" : "Validar"}
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => counting.countForHu(story)} disabled={!counting.context}>
                            <Sparkles className="mr-1 h-3 w-3" />Calcular
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={counting.dialog.open}
        onOpenChange={(open) => !counting.validating && counting.setDialog((current) => ({ ...current, open }))}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Validar contagem — {counting.dialog.hu?.code}</DialogTitle></DialogHeader>
          <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
            {counting.dialog.items.map((item, index) => {
              const processCountable = item.selectedProcessRole !== "auxiliary"
                && item.selectedProcessComplete
                && item.selectedProcessIndependent;
              const weight = processCountable
                ? counting.getFunctionWeight(item.selectedFunction)
                : 0;
              const pct = processCountable
                ? counting.getFactorPct(item.selectedFactor)
                : 0;
              const pfFs = calculatePfFs(weight, pct);
              return (
                <Card key={item.id} className={item.counting_decision === "review_required" ? "border-amber-400" : ""}>
                  <CardContent className="space-y-4 pt-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{item.ef_description}</p>
                        <p className="text-xs text-muted-foreground">{item.justification}</p>
                      </div>
                      <ProcessDecisionBadge decision={item.counting_decision ?? "counted"} />
                    </div>

                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Processo elementar
                      </p>
                      <p className="mt-1 font-medium">{item.elementary_process_name ?? item.ef_description}</p>
                      <p className="text-xs text-muted-foreground">{item.process_reasoning}</p>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <Selector
                          label="Tratamento"
                          value={item.selectedProcessRole}
                          onChange={(value) => counting.updateValidationItem(index, {
                            selectedProcessRole: value as ElementaryProcessRole,
                            selectedProcessComplete: value === "auxiliary" ? false : item.selectedProcessComplete,
                            selectedProcessIndependent: value === "auxiliary" ? false : item.selectedProcessIndependent,
                          })}
                          options={[
                            { value: "central", label: "Processo central" },
                            { value: "independent", label: "Processo independente" },
                            { value: "auxiliary", label: "Ação auxiliar — absorver" },
                          ]}
                        />
                        <div className="space-y-1">
                          <Label>Precedente oficial para separação</Label>
                          <Input
                            value={item.selectedProcessPrecedent}
                            onChange={(event) => counting.updateValidationItem(index, {
                              selectedProcessPrecedent: event.target.value,
                            })}
                            placeholder="Referência da baseline, medição ou decisão do time"
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-5 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={item.selectedProcessComplete}
                            disabled={item.selectedProcessRole === "auxiliary"}
                            onChange={(event) => counting.updateValidationItem(index, {
                              selectedProcessComplete: event.target.checked,
                            })}
                          />
                          Processo completo
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={item.selectedProcessIndependent}
                            disabled={item.selectedProcessRole === "auxiliary"}
                            onChange={(event) => counting.updateValidationItem(index, {
                              selectedProcessIndependent: event.target.checked,
                            })}
                          />
                          Processo independente
                        </label>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-4">
                      <Selector
                        label="Tipo"
                        value={item.selectedFunction}
                        onChange={(value) => counting.updateValidationItem(index, { selectedFunction: value })}
                        options={[
                          { value: "N/A", label: "N/A" },
                          ...(counting.context?.function_types.map((type) => ({
                            value: type.sigla, label: `${type.sigla} — ${type.weight}`,
                          })) ?? []),
                        ]}
                      />
                      <Selector
                        label="Impacto"
                        value={item.selectedFactor}
                        onChange={(value) => counting.updateValidationItem(index, { selectedFactor: value })}
                        options={[
                          { value: "N/A", label: "N/A" },
                          ...(counting.context?.impact_factors.map((factor) => ({
                            value: factor.sigla, label: `${factor.sigla} — ${factor.contribution_pct}%`,
                          })) ?? []),
                        ]}
                      />
                      <Metric label="PF Bruto" value={weight.toFixed(2)} />
                      <Metric label="PF Simples" value={pfFs.toFixed(2)} primary />
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {counting.dialogWasCorrected && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Selector
                  label="Motivo da decisão/correção *"
                  value={counting.dialog.correctionReason}
                  placeholder="Selecione"
                  onChange={(value) => counting.setDialog((current) => ({
                    ...current, correctionReason: value as CorrectionReason,
                  }))}
                  options={CORRECTION_REASONS.map((reason) => ({ value: reason.value, label: reason.label }))}
                />
                <div className="space-y-1">
                  <Label>Justificativa do analista</Label>
                  <Textarea
                    value={counting.dialog.correctionNotes}
                    onChange={(event) => counting.setDialog((current) => ({
                      ...current, correctionNotes: event.target.value,
                    }))}
                    placeholder="Explique por que o processo é independente ou por que a ação foi absorvida."
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => counting.setDialog((current) => ({ ...current, open: false }))}>
              Cancelar
            </Button>
            <Button
              onClick={counting.confirmValidation}
              disabled={counting.validating || (counting.dialogWasCorrected && !counting.dialog.correctionReason)}
            >
              {counting.validating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar decisão e validação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProcessDecisionBadge({ decision }: { decision: CountingDecision }) {
  const config: Record<CountingDecision, { label: string; className: string }> = {
    counted: { label: "Contado", className: "bg-emerald-100 text-emerald-700" },
    absorbed: { label: "Absorvido", className: "bg-slate-100 text-slate-700" },
    review_required: { label: "Revisar", className: "bg-amber-100 text-amber-800" },
    not_countable: { label: "Não mensurável", className: "bg-slate-100 text-slate-600" },
  };
  const value = config[decision];
  return <Badge className={value.className}>{value.label}</Badge>;
}

function Kpi({ label, value, primary, success }: { label: string; value: string | number; primary?: boolean; success?: boolean }) {
  return (
    <Card><CardContent className="pt-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${primary ? "text-primary" : success ? "text-emerald-600" : ""}`}>{value}</p>
    </CardContent></Card>
  );
}

function Metric({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return <div><Label>{label}</Label><p className={`mt-2 font-semibold ${primary ? "text-primary" : ""}`}>{value}</p></div>;
}

function Selector({
  label, value, onChange, options, placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>{options.map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}</SelectContent>
      </Select>
    </div>
  );
}
