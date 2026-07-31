import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOkrInitiativesV2 } from "../hooks/useOkrInitiativesV2";
import {
  OKR_INITIATIVE_PRIORITY_LABEL,
  OKR_INITIATIVE_STATUS_LABEL,
  type OkrInitiativePriority,
  type OkrInitiativeStatus,
} from "../types/initiative";

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Erro inesperado";
}

export function OkrInitiativesDialog({
  objectiveId,
  objectiveTitle,
  onClose,
}: {
  objectiveId: string | null;
  objectiveTitle?: string;
  onClose: () => void;
}) {
  const initiatives = useOkrInitiativesV2(objectiveId);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<OkrInitiativePriority>("medium");
  const [dueDate, setDueDate] = useState("");

  if (!objectiveId) return null;

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Informe o título da iniciativa.");
      return;
    }
    try {
      await initiatives.create.mutateAsync({
        title: title.trim(),
        priority,
        due_date: dueDate || null,
      });
      toast.success("Iniciativa criada.");
      setTitle("");
      setDueDate("");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleStatus = async (id: string, status: OkrInitiativeStatus) => {
    let reason: string | null = null;
    if (status === "blocked" || status === "cancelled") {
      reason = window.prompt(
        status === "blocked" ? "Motivo do bloqueio:" : "Motivo do cancelamento:",
      );
      if (!reason) {
        toast.error("Motivo é obrigatório.");
        return;
      }
    }
    try {
      await initiatives.update.mutateAsync({
        id,
        payload: {
          status,
          ...(status === "blocked" ? { blocked_reason: reason } : {}),
          ...(status === "cancelled" ? { cancelled_reason: reason } : {}),
        },
      });
      toast.success("Iniciativa atualizada.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleProgress = async (id: string, value: string) => {
    const progress = Number(value);
    if (Number.isNaN(progress) || progress < 0 || progress > 100) return;
    try {
      await initiatives.update.mutateAsync({ id, payload: { progress } });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Iniciativas — {objectiveTitle ?? ""}</DialogTitle>
          <DialogDescription>
            Planos de ação vinculados ao objective. Bloqueio e cancelamento exigem motivo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-[2fr_1fr_1fr_auto] items-end gap-3">
            <div>
              <Label htmlFor="okr-initiative-title">Título</Label>
              <Input
                id="okr-initiative-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as OkrInitiativePriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OKR_INITIATIVE_PRIORITY_LABEL).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <Button onClick={handleCreate} disabled={initiatives.create.isPending}>
              Adicionar
            </Button>
          </div>

          <div className="space-y-2">
            {initiatives.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : initiatives.initiatives.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma iniciativa.</p>
            ) : (
              initiatives.initiatives.map((i) => (
                <div
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-[220px]">
                    <p className="text-sm font-medium">{i.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {OKR_INITIATIVE_PRIORITY_LABEL[i.priority] ?? i.priority}
                      {i.due_date ? ` · prazo ${i.due_date}` : ""}
                      {i.blocked_reason ? ` · ${i.blocked_reason}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {OKR_INITIATIVE_STATUS_LABEL[i.status] ?? i.status}
                  </Badge>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="w-24"
                    defaultValue={String(i.progress ?? 0)}
                    onBlur={(e) => handleProgress(i.id, e.target.value)}
                  />
                  <Select value={i.status} onValueChange={(v) => handleStatus(i.id, v as OkrInitiativeStatus)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["planned", "in_progress", "blocked", "completed", "cancelled"] as const).map((s) => (
                        <SelectItem key={s} value={s}>
                          {OKR_INITIATIVE_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => initiatives.archive.mutateAsync({ id: i.id })}
                  >
                    Arquivar
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
