import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { useContractualApfCounting } from "../hooks/useContractualApfCounting";

export function ApfAnalysisReviewDialog({
  counting,
}: {
  counting: ReturnType<typeof useContractualApfCounting>;
}) {
  return (
    <Dialog
      open={counting.analysisDialog.open}
      onOpenChange={(open) => !counting.resolvingAnalysis
        && counting.setAnalysisDialog((current) => ({ ...current, open }))}
    >
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Revisar separação de processos — {counting.analysisDialog.hu?.code}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[68vh] space-y-4 overflow-y-auto pr-1">
          {counting.analysisDialog.analysis && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p><strong>Processo central:</strong> {counting.analysisDialog.analysis.processo_central.nome}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {counting.analysisDialog.analysis.processo_central.justificativa}
              </p>
              <p className="mt-2"><strong>Fator da HU:</strong> {counting.analysisDialog.analysis.inferred_factor_sigla}</p>
            </div>
          )}

          {counting.analysisDialog.analysis?.processos.map((process, index) => {
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

          {counting.analysisDialog.analysis?.itens_absorvidos_no_processo_central.length ? (
            <div className="rounded-md border p-3 text-sm">
              <strong>Itens absorvidos no processo central</strong>
              <ul className="mt-1 list-disc pl-5">
                {counting.analysisDialog.analysis.itens_absorvidos_no_processo_central.map((item, index) => (
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
            onClick={counting.confirmAnalysisReview}
            disabled={counting.resolvingAnalysis || counting.analysisDialog.decisions.some(
              (decision) => decision.send && !decision.baseline_item_id,
            )}
          >
            {counting.resolvingAnalysis && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar e enviar elegíveis ao contador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
