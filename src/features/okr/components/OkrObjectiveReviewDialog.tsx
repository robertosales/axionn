import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOkrCycles } from "../hooks/useOkrCycles";
import { useOkrObjectiveReviews } from "../hooks/useOkrReviewsV2";
import {
  OKR_CARRY_FORWARD_LABEL,
  OKR_REVIEW_STATUS_LABEL,
  type OkrCarryForwardDecision,
  type OkrCarryForwardType,
  type OkrObjectiveReviewInput,
} from "../types/review";
import type { OkrObjectiveV2 } from "../types/objective";

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Erro inesperado";
}

const EMPTY: OkrObjectiveReviewInput = {
  outcome_summary: "",
  what_worked: "",
  what_did_not_work: "",
  lessons_learned: "",
  recommendation: "",
  impact_rating: "medium",
  carry_forward_decision: "none",
  carry_forward_reason: "",
};

export function OkrObjectiveReviewDialog({
  objective,
  onClose,
}: {
  objective: OkrObjectiveV2 | null;
  onClose: () => void;
}) {
  const reviews = useOkrObjectiveReviews(objective?.cycle_id ?? null);
  const cycles = useOkrCycles();
  const [form, setForm] = useState<OkrObjectiveReviewInput>(EMPTY);
  const [rejectReason, setRejectReason] = useState("");
  const [cfCycleId, setCfCycleId] = useState("");
  const [cfType, setCfType] = useState<OkrCarryForwardType>("full_objective");
  const [cfReason, setCfReason] = useState("");

  const current = objective ? reviews.byObjective(objective.id) : null;

  useEffect(() => {
    if (current) {
      setForm({
        outcome_summary: current.outcome_summary ?? "",
        what_worked: current.what_worked ?? "",
        what_did_not_work: current.what_did_not_work ?? "",
        lessons_learned: current.lessons_learned ?? "",
        recommendation: current.recommendation ?? "",
        impact_rating: current.impact_rating ?? "medium",
        final_score: current.final_score,
        carry_forward_decision: current.carry_forward_decision ?? "none",
        carry_forward_reason: current.carry_forward_reason ?? "",
      });
    } else {
      setForm(EMPTY);
    }
  }, [current?.id, objective?.id]);

  const targetCycles = useMemo(
    () =>
      cycles.cycles.filter(
        (c) =>
          ["draft", "planning", "active"].includes(c.status) && c.id !== (objective?.cycle_id ?? ""),
      ),
    [cycles.cycles, objective?.cycle_id],
  );

  if (!objective) return null;

  const readOnly = current?.review_status === "approved";

  const handleSubmit = async () => {
    if (!form.outcome_summary.trim()) {
      toast.error("Resumo do resultado é obrigatório.");
      return;
    }
    try {
      await reviews.submit.mutateAsync({ objectiveId: objective.id, payload: form });
      toast.success("Review enviada.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleDecide = async (approve: boolean) => {
    if (!current) return;
    try {
      await reviews.decide.mutateAsync({
        reviewId: current.id,
        approve,
        reason: approve ? null : rejectReason,
      });
      toast.success(approve ? "Review aprovada e objective concluído." : "Review rejeitada.");
      setRejectReason("");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleCarryForward = async () => {
    if (!cfCycleId || !cfReason.trim()) {
      toast.error("Selecione o ciclo destino e informe o motivo.");
      return;
    }
    try {
      await reviews.carryForward.mutateAsync({
        objectiveId: objective.id,
        targetCycleId: cfCycleId,
        type: cfType,
        reason: cfReason,
      });
      toast.success("Objective transferido para o próximo ciclo.");
      setCfReason("");
      setCfCycleId("");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review — {objective.title}</DialogTitle>
          <DialogDescription>
            Registre o resultado final, aprendizados e a decisão de carry-forward do objective.
          </DialogDescription>
        </DialogHeader>

        {current && (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline">{OKR_REVIEW_STATUS_LABEL[current.review_status]}</Badge>
            {current.final_score != null && <span>Nota final: {current.final_score}</span>}
            {current.rejection_reason && (
              <span className="text-destructive">Rejeição: {current.rejection_reason}</span>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nota final (%)</Label>
              <Input
                type="number"
                min={0}
                disabled={readOnly}
                value={form.final_score ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    final_score: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                placeholder="Vazio usa o progresso calculado"
              />
            </div>
            <div>
              <Label>Impacto percebido</Label>
              <Select
                value={form.impact_rating ?? "medium"}
                onValueChange={(v) => setForm((f) => ({ ...f, impact_rating: v }))}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixo</SelectItem>
                  <SelectItem value="medium">Médio</SelectItem>
                  <SelectItem value="high">Alto</SelectItem>
                  <SelectItem value="transformational">Transformacional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Resumo do resultado *</Label>
            <Textarea
              rows={3}
              disabled={readOnly}
              value={form.outcome_summary}
              onChange={(e) => setForm((f) => ({ ...f, outcome_summary: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>O que funcionou</Label>
              <Textarea
                rows={3}
                disabled={readOnly}
                value={form.what_worked ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, what_worked: e.target.value }))}
              />
            </div>
            <div>
              <Label>O que não funcionou</Label>
              <Textarea
                rows={3}
                disabled={readOnly}
                value={form.what_did_not_work ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, what_did_not_work: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Lições aprendidas</Label>
            <Textarea
              rows={2}
              disabled={readOnly}
              value={form.lessons_learned ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, lessons_learned: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Decisão de carry-forward</Label>
              <Select
                value={form.carry_forward_decision ?? "none"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, carry_forward_decision: v as OkrCarryForwardDecision }))
                }
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OKR_CARRY_FORWARD_LABEL).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motivo do carry-forward</Label>
              <Input
                disabled={readOnly || (form.carry_forward_decision ?? "none") === "none"}
                value={form.carry_forward_reason ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, carry_forward_reason: e.target.value }))}
              />
            </div>
          </div>

          {!readOnly && (
            <Button onClick={handleSubmit} disabled={reviews.submit.isPending}>
              {current ? "Reenviar review" : "Enviar review"}
            </Button>
          )}

          {current?.review_status === "submitted" && (
            <div className="space-y-2 rounded border p-3">
              <h4 className="text-sm font-semibold">Aprovação</h4>
              <p className="text-xs text-muted-foreground">
                Aprovar congela os Key Results num snapshot final e conclui o objective.
              </p>
              <Input
                placeholder="Motivo da rejeição (obrigatório para rejeitar)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleDecide(true)} disabled={reviews.decide.isPending}>
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDecide(false)}
                  disabled={reviews.decide.isPending}
                >
                  Rejeitar
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2 rounded border p-3">
            <h4 className="text-sm font-semibold">Carry-forward para o próximo ciclo</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ciclo destino</Label>
                <Select value={cfCycleId} onValueChange={setCfCycleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetCycles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={cfType} onValueChange={(v) => setCfType(v as OkrCarryForwardType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_objective">Objective completo</SelectItem>
                    <SelectItem value="selected_key_results">Key Results selecionados</SelectItem>
                    <SelectItem value="rewritten_objective">Objective reescrito</SelectItem>
                    <SelectItem value="learning_only">Somente aprendizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Input
              placeholder="Motivo do carry-forward"
              value={cfReason}
              onChange={(e) => setCfReason(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleCarryForward}
              disabled={reviews.carryForward.isPending}
            >
              Transferir objective
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
