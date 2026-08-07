import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useOkrCycleReview } from "../hooks/useOkrReviewsV2";
import type { OkrCycleReviewInput } from "../types/review";

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Erro inesperado";
}

const EMPTY: OkrCycleReviewInput = {
  main_achievements: "",
  main_failures: "",
  cross_team_dependencies: "",
  lessons_learned: "",
  strategic_recommendations: "",
};

export function OkrCycleReviewPanel({ cycleId }: { cycleId: string | null }) {
  const { review, isLoading, generate, approve } = useOkrCycleReview(cycleId);
  const [form, setForm] = useState<OkrCycleReviewInput>(EMPTY);

  useEffect(() => {
    if (review) {
      setForm({
        main_achievements: review.main_achievements ?? "",
        main_failures: review.main_failures ?? "",
        cross_team_dependencies: review.cross_team_dependencies ?? "",
        lessons_learned: review.lessons_learned ?? "",
        strategic_recommendations: review.strategic_recommendations ?? "",
      });
    } else {
      setForm(EMPTY);
    }
  }, [review?.id, cycleId]);

  if (!cycleId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review do ciclo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Selecione um ciclo específico para consolidar a review de encerramento.
          </p>
        </CardContent>
      </Card>
    );
  }

  const approved = !!review?.approved_at;

  const handleGenerate = async () => {
    try {
      await generate.mutateAsync(form);
      toast.success("Review do ciclo consolidada.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleApprove = async (close: boolean) => {
    try {
      await approve.mutateAsync(close);
      toast.success(close ? "Ciclo aprovado e encerrado." : "Review do ciclo aprovada.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Review do ciclo</CardTitle>
        {approved && <Badge className="bg-emerald-100 text-emerald-800">Aprovada</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            {review && (
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                <Metric label="Nota final" value={review.final_score ?? "—"} />
                <Metric label="Objectives" value={review.objectives_total} />
                <Metric label="Concluídos" value={review.objectives_completed} />
                <Metric label="Transferidos" value={review.objectives_carried_forward} />
                <Metric
                  label="Aderência check-in"
                  value={review.check_in_compliance != null ? `${review.check_in_compliance}%` : "—"}
                />
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="okr-cycle-review-achievements">Principais conquistas</Label>
                <Textarea
                  id="okr-cycle-review-achievements"
                  rows={3}
                  disabled={approved}
                  value={form.main_achievements ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, main_achievements: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="okr-cycle-review-failures">Principais falhas</Label>
                <Textarea
                  id="okr-cycle-review-failures"
                  rows={3}
                  disabled={approved}
                  value={form.main_failures ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, main_failures: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="okr-cycle-review-dependencies">Dependências entre times</Label>
                <Textarea
                  id="okr-cycle-review-dependencies"
                  rows={2}
                  disabled={approved}
                  value={form.cross_team_dependencies ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cross_team_dependencies: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="okr-cycle-review-lessons">Lições aprendidas</Label>
                <Textarea
                  id="okr-cycle-review-lessons"
                  rows={2}
                  disabled={approved}
                  value={form.lessons_learned ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, lessons_learned: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="okr-cycle-review-recommendations">Recomendações estratégicas</Label>
                <Textarea
                  id="okr-cycle-review-recommendations"
                  rows={2}
                  disabled={approved}
                  value={form.strategic_recommendations ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, strategic_recommendations: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleGenerate} disabled={approved || generate.isPending}>
                {review ? "Atualizar consolidação" : "Consolidar review"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleApprove(false)}
                disabled={!review || approved || approve.isPending}
              >
                Aprovar review
              </Button>
              <Button
                variant="outline"
                onClick={() => handleApprove(true)}
                disabled={!review || approve.isPending}
              >
                Aprovar e encerrar ciclo
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
