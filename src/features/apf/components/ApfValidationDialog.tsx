import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import type { useContractualApfCounting } from "../hooks/useContractualApfCounting";
import { CORRECTION_REASONS, CorrectionReason } from "../types/contractualApf.constants";
import type { CountingDecision, ElementaryProcessRole } from "../utils/elementaryProcess";
import { calculatePfFs } from "../utils/contractualApf.helpers";

export function ApfValidationDialog({
  counting,
}: {
  counting: ReturnType<typeof useContractualApfCounting>;
}) {
  return (
    <Dialog
      open={counting.dialog.open}
      onOpenChange={(open) => !counting.validating
        && counting.setDialog((current) => ({ ...current, open }))}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Validar contagem — {counting.dialog.hu?.code}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          {counting.dialog.items.map((item, index) => {
            const processCountable = item.selectedProcessRole !== "auxiliary"
              && item.selectedProcessComplete
              && item.selectedProcessIndependent;
            const weight = processCountable
              ? item.baseline_item_id
                ? Number(item.pf_bruto)
                : counting.getFunctionWeight(item.selectedFunction)
              : 0;
            const pct = processCountable ? counting.getFactorPct(item.selectedFactor) : 0;
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
                      label={item.baseline_item_id ? "Tipo da baseline" : "Tipo"}
                      value={item.selectedFunction}
                      onChange={(value) => counting.updateValidationItem(index, { selectedFunction: value })}
                      disabled={Boolean(item.baseline_item_id)}
                      options={[
                        { value: "N/A", label: "N/A" },
                        ...(counting.context?.function_types.map((type) => ({
                          value: type.sigla,
                          label: `${type.sigla} — ${type.weight}`,
                        })) ?? []),
                      ]}
                    />
                    <Selector
                      label="Fator de impacto da HU"
                      value={item.selectedFactor}
                      onChange={(value) => counting.updateValidationItem(index, { selectedFactor: value })}
                      options={[
                        { value: "N/A", label: "N/A" },
                        ...(counting.context?.impact_factors.map((factor) => ({
                          value: factor.sigla,
                          label: `${factor.sigla} — ${factor.contribution_pct}%`,
                        })) ?? []),
                      ]}
                    />
                    <Metric label="PF Bruto da baseline" value={weight.toFixed(2)} />
                    <Metric label="PF Simples da HU" value={pfFs.toFixed(2)} primary />
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
                  ...current,
                  correctionReason: value as CorrectionReason,
                }))}
                options={CORRECTION_REASONS.map((reason) => ({
                  value: reason.value,
                  label: reason.label,
                }))}
              />
              <div className="space-y-1">
                <Label>Justificativa do analista</Label>
                <Textarea
                  value={counting.dialog.correctionNotes}
                  onChange={(event) => counting.setDialog((current) => ({
                    ...current,
                    correctionNotes: event.target.value,
                  }))}
                  placeholder="Explique o fator aplicado ou a decisão sobre o processo."
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => counting.setDialog((current) => ({ ...current, open: false }))}
          >
            Cancelar
          </Button>
          <Button
            onClick={counting.confirmValidation}
            disabled={counting.validating
              || (counting.dialogWasCorrected && !counting.dialog.correctionReason)}
          >
            {counting.validating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar decisão e validação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function Metric({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className={`mt-2 font-semibold ${primary ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function Selector({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
