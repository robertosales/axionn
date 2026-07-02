import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { useContractualApfCounting } from "../hooks/useContractualApfCounting";
import type { FactorOverrideReason } from "../types/apfRuntime.types";
import {
  calculateFactorPreview,
  factorReviewIsValid,
  factorWasOverridden,
} from "../utils/factorReview";

const FACTOR_SOURCE_LABELS: Record<string, string> = {
  official_history: "Histórico oficial de métricas",
  validated_precedent: "Precedente humano validado",
  explicit_rule: "Evidência textual explícita",
  conservative_default: "Padrão conservador",
  legacy: "Análise legada",
  legacy_preserved: "Histórico preservado",
  human_override: "Alteração do especialista",
};

const FACTOR_OVERRIDE_REASONS: Array<{ value: FactorOverrideReason; label: string }> = [
  { value: "correcao_classificacao", label: "Correção da classificação automática" },
  { value: "precedente_oficial", label: "Precedente oficial aplicável" },
  { value: "regra_contratual", label: "Regra contratual ou normativa" },
  { value: "evidencia_funcional", label: "Evidência funcional da HU" },
  { value: "outro", label: "Outro motivo" },
];

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ApfAnalysisReviewDialog({
  counting,
}: {
  counting: ReturnType<typeof useContractualApfCounting>;
}) {
  const analysis = counting.analysisDialog.analysis;
  const [factorSigla, setFactorSigla] = useState("");
  const [overrideReason, setOverrideReason] = useState<FactorOverrideReason | "">("");
  const [overrideNotes, setOverrideNotes] = useState("");

  useEffect(() => {
    setFactorSigla(
      analysis?.confirmed_factor_sigla
      ?? analysis?.inferred_factor_sigla
      ?? "",
    );
    setOverrideReason(analysis?.factor_override_reason ?? "");
    setOverrideNotes(analysis?.factor_override_notes ?? "");
  }, [
    analysis?.id,
    analysis?.confirmed_factor_sigla,
    analysis?.inferred_factor_sigla,
    analysis?.factor_override_reason,
    analysis?.factor_override_notes,
  ]);

  const functionWeights = useMemo(() => Object.fromEntries(
    (counting.context?.function_types ?? []).map((item) => [item.sigla, Number(item.weight)]),
  ), [counting.context?.function_types]);

  const factorPct = Number(
    counting.context?.impact_factors.find((factor) => factor.sigla === factorSigla)?.contribution_pct
    ?? 0,
  );

  const previewLines = useMemo(() => counting.analysisDialog.decisions.map((decision, index) => {
    const process = analysis?.processos[index];
    const selectedAnalog = process?.baseline_analogas.find(
      (analog) => analog.baseline_item_id === decision.baseline_item_id,
    );
    return {
      send: decision.send,
      functionSigla: selectedAnalog?.tipo ?? process?.tipo_funcional_candidato ?? null,
    };
  }), [analysis?.processos, counting.analysisDialog.decisions]);

  const preview = useMemo(() => calculateFactorPreview(
    previewLines,
    functionWeights,
    factorPct,
  ), [factorPct, functionWeights, previewLines]);

  const factorChanged = factorWasOverridden(
    analysis?.inferred_factor_sigla,
    factorSigla,
  );
  const hasMissingBaseline = counting.analysisDialog.decisions.some(
    (decision) => decision.send && !decision.baseline_item_id,
  );
  const canConfirm = factorReviewIsValid({
    suggestedFactor: analysis?.inferred_factor_sigla,
    confirmedFactor: factorSigla,
    overrideReason,
    selectedProcesses: preview.selectedProcesses,
    hasMissingBaseline,
  });
  const sourceLabel = FACTOR_SOURCE_LABELS[analysis?.factor_source ?? ""]
    ?? analysis?.factor_source
    ?? "Não informada";
  const confidenceLabel = analysis?.factor_confidence == null
    ? "Não informada"
    : `${Math.round(Number(analysis.factor_confidence) * 100)}%`;

  return (
    <Dialog
      open={counting.analysisDialog.open}
      onOpenChange={(open) => !counting.resolvingAnalysis
        && counting.setAnalysisDialog((current) => ({ ...current, open }))}
    >
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Revisar processos e fator — {counting.analysisDialog.hu?.code}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {analysis && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p><strong>Processo central:</strong> {analysis.processo_central.nome}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {analysis.processo_central.justificativa}
              </p>
            </div>
          )}

          {analysis && (
            <Card className={analysis.factor_review_required ? "border-amber-400" : ""}>
              <CardContent className="space-y-4 pt-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">Revisão do fator</Badge>
                      {analysis.factor_review_required && (
                        <Badge variant="secondary">Confirmação obrigatória</Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm">
                      <strong>Fator sugerido:</strong> {analysis.inferred_factor_sigla}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Fonte: {sourceLabel} · Confiança: {confidenceLabel}
                    </p>
                  </div>
                  <div className="min-w-48 rounded-md border bg-background px-3 py-2 text-right">
                    <p className="text-xs text-muted-foreground">Prévia da contagem</p>
                    <p className="text-lg font-semibold">{formatNumber(preview.pfFs)} PF</p>
                  </div>
                </div>

                {analysis.factor_reasoning && (
                  <div className="rounded-md border bg-muted/20 p-3 text-sm">
                    <strong>Justificativa do cérebro</strong>
                    <p className="mt-1 text-muted-foreground">{analysis.factor_reasoning}</p>
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="confirmed-factor">Fator confirmado</Label>
                    <select
                      id="confirmed-factor"
                      value={factorSigla}
                      onChange={(event) => {
                        setFactorSigla(event.target.value);
                        if (event.target.value === analysis.inferred_factor_sigla) {
                          setOverrideReason("");
                          setOverrideNotes("");
                        }
                      }}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Selecione o fator da HU</option>
                      {(counting.context?.impact_factors ?? []).map((factor) => (
                        <option key={factor.id} value={factor.sigla}>
                          {factor.sigla} — {factor.name} ({Number(factor.contribution_pct).toFixed(0)}%)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-md border p-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Processos</p>
                      <p className="font-medium">{preview.selectedProcesses}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">PF bruto</p>
                      <p className="font-medium">{formatNumber(preview.pfBruto)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Percentual</p>
                      <p className="font-medium">{formatNumber(preview.contributionPct)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">PF final</p>
                      <p className="font-medium">{formatNumber(preview.pfFs)}</p>
                    </div>
                  </div>
                </div>

                {factorChanged && (
                  <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950">
                    <div>
                      <strong>Alteração do fator sugerido</strong>
                      <p className="mt-1 text-xs">
                        O cérebro sugeriu {analysis.inferred_factor_sigla}, mas será confirmado {factorSigla}.
                        O motivo será registrado como aprendizado e evidência de auditoria.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="factor-override-reason">Motivo da alteração</Label>
                      <select
                        id="factor-override-reason"
                        value={overrideReason}
                        onChange={(event) => setOverrideReason(event.target.value as FactorOverrideReason | "")}
                        className="h-10 w-full rounded-md border border-amber-400 bg-background px-3 text-sm"
                      >
                        <option value="">Selecione o motivo</option>
                        {FACTOR_OVERRIDE_REASONS.map((reason) => (
                          <option key={reason.value} value={reason.value}>{reason.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="factor-override-notes">Observações</Label>
                      <textarea
                        id="factor-override-notes"
                        value={overrideNotes}
                        onChange={(event) => setOverrideNotes(event.target.value)}
                        placeholder="Descreva a evidência, regra ou precedente utilizado."
                        className="min-h-20 w-full rounded-md border border-amber-400 bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {analysis?.processos.map((process, index) => {
            const decision = counting.analysisDialog.decisions[index];
            const transactionalAnalogs = process.baseline_analogas.filter(
              (analog) => ["EE", "CE", "SE", "TRN"].includes(analog.tipo)
                && Boolean(analog.baseline_item_id),
            );
            return (
              <Card key={process.id} className={process.requer_validacao_humana ? "border-amber-400" : ""}>
                <CardContent className="space-y-4 pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {process.central && <Badge variant="outline">Processo central</Badge>}
                        <Badge variant="outline">{process.tipo_funcional_candidato}</Badge>
                        {process.selected_by_default && <Badge variant="secondary">Pré-selecionado</Badge>}
                      </div>
                      <p className="mt-2 font-medium">{process.nome_processo}</p>
                      <p className="text-xs text-muted-foreground">{process.justificativa_separacao}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={decision?.send ?? false}
                        onChange={(event) => counting.updateAnalysisDecision(index, {
                          send: event.target.checked,
                        })}
                      />
                      Enviar ao contador
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Ação / objeto de negócio</Label>
                      <p className="mt-1 text-sm">{process.acao_negocio} · {process.objeto_negocio}</p>
                    </div>
                    <div>
                      <Label>Resultado funcional</Label>
                      <p className="mt-1 text-sm">{process.resultado_funcional_entregue || "Não informado"}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Item homologado da baseline</Label>
                    <select
                      value={decision?.baseline_item_id ?? ""}
                      disabled={!decision?.send}
                      onChange={(event) => counting.updateAnalysisDecision(index, {
                        baseline_item_id: event.target.value || null,
                      })}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Selecione o precedente que será contado</option>
                      {transactionalAnalogs.map((analog) => (
                        <option key={analog.id ?? analog.baseline_item_id ?? analog.item_baseline} value={analog.baseline_item_id ?? ""}>
                          {analog.tipo} — {analog.item_baseline} ({analog.aderencia})
                        </option>
                      ))}
                    </select>
                  </div>

                  {process.arquivos_logicos_referenciados.length > 0 && (
                    <div className="rounded-md border p-3">
                      <Label>ALI/AIE referenciados — não são processos</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {process.arquivos_logicos_referenciados.map((file, fileIndex) => (
                          <Badge key={`${file.nome}-${fileIndex}`} variant="outline">
                            {file.tipo} · {file.nome} · {file.papel_no_processo}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {process.duvidas_ou_riscos.length > 0 && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                      <strong>Dúvidas ou riscos</strong>
                      <ul className="mt-1 list-disc pl-5">
                        {process.duvidas_ou_riscos.map((risk, riskIndex) => (
                          <li key={`${risk}-${riskIndex}`}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {analysis?.itens_absorvidos_no_processo_central.length ? (
            <div className="rounded-md border p-3 text-sm">
              <strong>Itens absorvidos no processo central</strong>
              <ul className="mt-1 list-disc pl-5">
                {analysis.itens_absorvidos_no_processo_central.map((item, index) => (
                  <li key={`${item.descricao}-${index}`}>
                    {item.descricao}: {item.motivo_absorcao}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => counting.setAnalysisDialog((current) => ({ ...current, open: false }))}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void counting.confirmAnalysisReview({
              factor_sigla: factorSigla,
              factor_override_reason: overrideReason,
              factor_override_notes: overrideNotes,
            })}
            disabled={counting.resolvingAnalysis || !canConfirm}
          >
            {counting.resolvingAnalysis && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar fator e enviar elegíveis ao contador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
