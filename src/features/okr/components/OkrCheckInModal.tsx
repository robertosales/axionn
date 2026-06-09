// ─── OkrCheckInModal ─────────────────────────────────────────────────────────
// Modal para registrar atualização de progresso em um Key Result

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { cn }       from "@/lib/utils";
import { MessageSquare } from "lucide-react";
import type { OkrKeyResult } from "../types";
import { krProgress, krProgressColor, krProgressTextColor } from "./OkrKeyResultRow";

interface Props {
  kr:       OkrKeyResult | null;
  onClose:  () => void;
  onSubmit: (krId: string, value: number, note: string) => void;
}

export function OkrCheckInModal({ kr, onClose, onSubmit }: Props) {
  const [value, setValue] = useState<string>("");
  const [note,  setNote]  = useState<string>("");
  const [error, setError] = useState<string>("");

  if (!kr) return null;

  const pct        = krProgress(kr);
  const valueNum   = parseFloat(value);
  const valueValid = !isNaN(valueNum);

  function handleSubmit() {
    if (!valueValid) {
      setError("Informe um valor numérico válido.");
      return;
    }
    if (!note.trim()) {
      setError("Adicione uma observação sobre o progresso.");
      return;
    }
    onSubmit(kr.id, valueNum, note.trim());
    setValue("");
    setNote("");
    setError("");
    onClose();
  }

  function handleClose() {
    setValue("");
    setNote("");
    setError("");
    onClose();
  }

  return (
    <Dialog open={!!kr} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4 text-primary" />
            Registrar Check-in
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info do KR */}
          <div className="rounded-lg bg-muted/50 border p-3 space-y-2">
            <p className="text-sm font-medium leading-snug">{kr.title}</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className={cn("h-1.5 rounded-full", krProgressColor(pct))}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-bold" style={{ color: krProgressTextColor(pct) }}>
                {pct}%
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Atual: <strong>{kr.current} {kr.unit}</strong> · Meta: <strong>{kr.target} {kr.unit}</strong>
            </p>
          </div>

          {/* Novo valor */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Novo valor <span className="text-muted-foreground">({kr.unit})</span>
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(""); }}
              placeholder={`Ex: ${kr.current}`}
              className="w-full h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Observação */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Observação</label>
            <textarea
              value={note}
              onChange={(e) => { setNote(e.target.value); setError(""); }}
              placeholder="O que aconteceu neste período? O que impactou este KR?"
              rows={3}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 font-medium">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!valueValid || !note.trim()}>
            Salvar Check-in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
