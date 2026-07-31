import { useState } from "react";
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
import { useOkrKeyResultsV2 } from "../hooks/useOkrKeyResultsV2";
import {
  OKR_KR_DIRECTION_LABEL,
  OKR_KR_LIFECYCLE_LABEL,
  OKR_KR_UPDATE_TYPE_LABEL,
  OKR_KR_UNITS,
  type OkrKeyResultV2,
  type OkrKeyResultV2Input,
  type OkrKrDirection,
  type OkrKrLifecycle,
  type OkrKrUnit,
  type OkrKrUpdateType,
} from "../types/keyResult";
import type { OkrObjectiveV2 } from "../types/objective";

const EMPTY: OkrKeyResultV2Input = {
  title: "",
  description: "",
  unit: "%",
  direction: "increase",
  update_type: "manual",
  frequency: "weekly",
  allow_overachievement: true,
};

const LIFECYCLE_BADGE: Record<OkrKrLifecycle, string> = {
  draft: "bg-slate-200 text-slate-800",
  active: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  completed: "bg-sky-100 text-sky-800",
  cancelled: "bg-rose-100 text-rose-800",
  archived: "bg-zinc-200 text-zinc-700",
};

function errMsg(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Erro inesperado";
}

function numberOrNull(value: string): number | null {
  if (value === "" || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatProgress(kr: OkrKeyResultV2): string {
  if (kr.calculated_progress == null) return "—";
  return `${Math.round(kr.calculated_progress)}%`;
}

export function OkrKeyResultsDialog({
  objective,
  onClose,
}: {
  objective: OkrObjectiveV2 | null;
  onClose: () => void;
}) {
  const [includeArchived, setIncludeArchived] = useState(false);
  const [form, setForm] = useState<OkrKeyResultV2Input>(EMPTY);
  const [editing, setEditing] = useState<OkrKeyResultV2 | null>(null);
  const krs = useOkrKeyResultsV2(objective?.id ?? null, includeArchived);

  if (!objective) return null;

  const objectiveLocked =
    objective.lifecycle_status === "archived" ||
    objective.lifecycle_status === "cancelled" ||
    objective.lifecycle_status === "completed";

  const reset = () => {
    setForm(EMPTY);
    setEditing(null);
  };

  const populateFrom = (kr: OkrKeyResultV2) => {
    setEditing(kr);
    setForm({
      title: kr.title,
      description: kr.description ?? "",
      unit: (kr.unit as OkrKrUnit) ?? "%",
      direction: (kr.direction as OkrKrDirection) ?? "increase",
      baseline_value: kr.baseline_value,
      current_value: kr.current_value,
      target_value: kr.target_value,
      target_min: kr.target_min,
      target_max: kr.target_max,
      weight: kr.weight,
      update_type: (kr.update_type as OkrKrUpdateType) ?? "manual",
      frequency: (kr.frequency as OkrKeyResultV2Input["frequency"]) ?? "weekly",
      metric_code: kr.metric_code,
      start_date: kr.start_date,
      end_date: kr.end_date,
      allow_overachievement: kr.allow_overachievement,
    });
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("Título obrigatório.");
      return;
    }
    try {
      if (editing) {
        await krs.update.mutateAsync({
          id: editing.id,
          payload: { ...form, lock_version: editing.lock_version },
        });
        toast.success("Key Result atualizado.");
      } else {
        await krs.create.mutateAsync(form);
        toast.success("Key Result criado.");
      }
      reset();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const handleArchive = async (kr: OkrKeyResultV2) => {
    const reason = window.prompt("Motivo do arquivamento (opcional):") ?? undefined;
    try {
      await krs.archive.mutateAsync({ id: kr.id, reason });
      toast.success("Key Result arquivado.");
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const isRange = form.direction === "range";
  const isBool = form.direction === "boolean";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Key Results — {objective.title}</DialogTitle>
          <DialogDescription>
            Motor de cálculo canônico no backend (v2). Progresso é recalculado a cada
            criação/edição.
          </DialogDescription>
        </DialogHeader>

        {objectiveLocked ? (
          <p className="rounded border bg-muted p-3 text-sm">
            Objective em <strong>{objective.lifecycle_status}</strong>. Edição de KRs bloqueada.
          </p>
        ) : (
          <div className="space-y-4 rounded-md border p-4">
            <h4 className="text-sm font-semibold">
              {editing ? "Editar Key Result" : "Novo Key Result"}
            </h4>
            <div>
              <Label htmlFor="okr-kr-title">Título</Label>
              <Input
                id="okr-kr-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex.: Reduzir MTTR de 8h para 4h"
              />
            </div>
            <div>
              <Label htmlFor="okr-kr-description">Descrição</Label>
              <Textarea
                id="okr-kr-description"
                value={form.description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <Label>Direção</Label>
                <Select
                  value={form.direction ?? "increase"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, direction: v as OkrKrDirection }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OKR_KR_DIRECTION_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidade</Label>
                <Select
                  value={form.unit ?? "%"}
                  onValueChange={(v) => setForm((f) => ({ ...f, unit: v as OkrKrUnit }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OKR_KR_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="okr-kr-weight">Peso (0–100)</Label>
                <Input
                  id="okr-kr-weight"
                  type="number"
                  min={0}
                  max={100}
                  value={form.weight ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, weight: numberOrNull(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label>Tipo de atualização</Label>
                <Select
                  value={form.update_type ?? "manual"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, update_type: v as OkrKrUpdateType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OKR_KR_UPDATE_TYPE_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!isBool && !isRange && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <Label htmlFor="okr-kr-baseline">Baseline</Label>
                  <Input
                    id="okr-kr-baseline"
                    type="number"
                    value={form.baseline_value ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, baseline_value: numberOrNull(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="okr-kr-current">Atual</Label>
                  <Input
                    id="okr-kr-current"
                    type="number"
                    value={form.current_value ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, current_value: numberOrNull(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="okr-kr-target">Meta</Label>
                  <Input
                    id="okr-kr-target"
                    type="number"
                    value={form.target_value ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, target_value: numberOrNull(e.target.value) }))
                    }
                  />
                </div>
              </div>
            )}

            {isRange && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div>
                  <Label htmlFor="okr-kr-range-baseline">Baseline</Label>
                  <Input
                    id="okr-kr-range-baseline"
                    type="number"
                    value={form.baseline_value ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, baseline_value: numberOrNull(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="okr-kr-range-current">Atual</Label>
                  <Input
                    id="okr-kr-range-current"
                    type="number"
                    value={form.current_value ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, current_value: numberOrNull(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <Label>Mínimo</Label>
                  <Input
                    type="number"
                    value={form.target_min ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, target_min: numberOrNull(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <Label>Máximo</Label>
                  <Input
                    type="number"
                    value={form.target_max ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, target_max: numberOrNull(e.target.value) }))
                    }
                  />
                </div>
              </div>
            )}

            {isBool && (
              <p className="text-xs text-muted-foreground">
                KR booleano: baseline 0, meta 1. Preencha o valor atual como 0 (não) ou 1 (sim).
              </p>
            )}

            <div className="flex justify-end gap-2">
              {editing && (
                <Button variant="outline" onClick={reset}>
                  Cancelar edição
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={krs.create.isPending || krs.update.isPending}
              >
                {editing ? "Salvar alterações" : "Adicionar KR"}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Key Results existentes</h4>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
              />
              Incluir arquivados
            </label>
          </div>

          {krs.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : krs.keyResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum Key Result.</p>
          ) : (
            <ul className="space-y-2">
              {krs.keyResults.map((kr) => (
                <li
                  key={kr.id}
                  className="flex items-start justify-between rounded border p-3 text-sm"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{kr.title}</span>
                      <Badge
                        className={
                          LIFECYCLE_BADGE[kr.lifecycle_status as OkrKrLifecycle] ??
                          "bg-slate-100 text-slate-700"
                        }
                      >
                        {OKR_KR_LIFECYCLE_LABEL[kr.lifecycle_status as OkrKrLifecycle] ??
                          kr.lifecycle_status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {OKR_KR_DIRECTION_LABEL[kr.direction as OkrKrDirection] ?? kr.direction}
                      {" · "}
                      baseline {kr.baseline_value ?? "—"} → atual {kr.current_value ?? "—"} → meta{" "}
                      {kr.direction === "range"
                        ? `${kr.target_min ?? "?"}–${kr.target_max ?? "?"}`
                        : kr.target_value ?? "—"}{" "}
                      {kr.unit}
                      {kr.weight != null && ` · peso ${kr.weight}`}
                    </p>
                    <p className="text-xs">
                      Progresso: <strong>{formatProgress(kr)}</strong>
                      {kr.measurement_quality === "no_data" && (
                        <span className="ml-2 text-amber-600">sem dados</span>
                      )}
                    </p>
                  </div>
                  {!objectiveLocked && kr.lifecycle_status !== "archived" && (
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant="outline" onClick={() => populateFrom(kr)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleArchive(kr)}>
                        Arquivar
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
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
