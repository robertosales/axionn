// src/features/kanban/components/FinalizeSprintModal.tsx
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button }  from "@/components/ui/button";
import { Badge }   from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label }   from "@/components/ui/label";
import { CheckCircle2, AlertCircle, Trophy, ArrowRight, Loader2 } from "lucide-react";
import type { SprintSummary } from "../hooks/useFinalizeSprint";

interface Props {
  open:      boolean;
  onClose:   () => void;
  summary:   SprintSummary | null;
  loading:   boolean;
  sprints:   { id: string; name: string; is_active?: boolean }[];
  onConfirm: (destination: "backlog" | string) => void;
}

export function FinalizeSprintModal({ open, onClose, summary, loading, sprints, onConfirm }: Props) {
  const [destination, setDestination] = useState<"backlog" | string>("backlog");
  const nextSprints = sprints.filter((s) => !(s as any).is_active);

  if (!summary) return null;
  const allDone = summary.incompleteCards === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {allDone
              ? <><Trophy className="h-5 w-5 text-yellow-500" /> Sprint Concluída com Sucesso!</>
              : <><AlertCircle className="h-5 w-5 text-amber-500" /> Finalizar Sprint</>}
          </DialogTitle>
          <DialogDescription>{summary.sprintName}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-primary">{summary.completionRate}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">Conclusão</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold">{summary.donePoints}<span className="text-sm font-normal text-muted-foreground">/{summary.totalPoints}</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">Story Points</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md bg-green-50 dark:bg-green-950/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Concluídos</span>
            </div>
            <Badge className="bg-green-600 hover:bg-green-600">{summary.doneCards} card{summary.doneCards !== 1 ? "s" : ""}</Badge>
          </div>
          {!allDone && (
            <div className="flex items-center justify-between rounded-md bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">Incompletos</span>
              </div>
              <Badge variant="outline" className="border-amber-500 text-amber-600">{summary.incompleteCards} card{summary.incompleteCards !== 1 ? "s" : ""}</Badge>
            </div>
          )}
        </div>

        {!allDone && (
          <div className="space-y-3">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              Mover cards incompletos para:
            </p>
            <RadioGroup value={destination} onValueChange={setDestination} className="space-y-2">
              <div className="flex items-center space-x-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="backlog" id="dest-backlog" />
                <Label htmlFor="dest-backlog" className="cursor-pointer flex-1">
                  <span className="font-medium">Backlog</span>
                  <span className="text-xs text-muted-foreground ml-2">(sem sprint)</span>
                </Label>
              </div>
              {nextSprints.map((s) => (
                <div key={s.id} className="flex items-center space-x-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value={s.id} id={`dest-${s.id}`} />
                  <Label htmlFor={`dest-${s.id}`} className="cursor-pointer flex-1">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">(próxima sprint)</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            onClick={() => onConfirm(destination)}
            disabled={loading}
            className={allDone ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700"}
          >
            {loading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Finalizando...</>
              : <><CheckCircle2 className="h-4 w-4 mr-2" />Finalizar Sprint</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
