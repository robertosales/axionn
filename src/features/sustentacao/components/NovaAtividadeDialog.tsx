import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useHours } from "../hooks/useDemandas";
import { FASES, FASE_LABELS } from "../types/demanda";
import type { Demanda } from "../types/demanda";

interface NovaAtividadeDialogProps {
  demanda: Demanda | null;
  open: boolean;
  onClose: () => void;
}

export function NovaAtividadeDialog({ demanda, open, onClose }: NovaAtividadeDialogProps) {
  const { add, loading } = useHours(demanda?.id ?? null);

  const [fase, setFase] = useState<string>("execucao");
  const [horas, setHoras] = useState<string>("1");
  const [descricao, setDescricao] = useState("");

  const reset = () => {
    setFase("execucao");
    setHoras("1");
    setDescricao("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSalvar = async () => {
    const h = parseFloat(horas);
    if (!fase) { toast.error("Selecione a fase."); return; }
    if (isNaN(h) || h <= 0) { toast.error("Informe um número de horas válido."); return; }
    if (!descricao.trim()) { toast.error("Informe uma descrição para a atividade."); return; }

    await add({ fase, horas: h, descricao: descricao.trim() });
    handleClose();
  };

  if (!demanda) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <svg
              className="h-4 w-4 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            Nova atividade
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {demanda.rhm ? `RHM ${demanda.rhm} — ` : ""}
            {demanda.descricao ?? demanda.tipo}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Fase */}
          <div className="space-y-1.5">
            <Label htmlFor="fase" className="text-xs font-medium">
              Fase
            </Label>
            <Select value={fase} onValueChange={setFase}>
              <SelectTrigger id="fase" className="h-9 text-sm">
                <SelectValue placeholder="Selecione a fase" />
              </SelectTrigger>
              <SelectContent>
                {FASES.map((f) => (
                  <SelectItem key={f} value={f} className="text-sm">
                    {FASE_LABELS[f] ?? f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Horas */}
          <div className="space-y-1.5">
            <Label htmlFor="horas" className="text-xs font-medium">
              Horas
            </Label>
            <Input
              id="horas"
              type="number"
              min="0.25"
              step="0.25"
              value={horas}
              onChange={(e) => setHoras(e.target.value)}
              className="h-9 text-sm"
              placeholder="ex: 2"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label htmlFor="descricao" className="text-xs font-medium">
              Descrição da atividade
            </Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o que foi feito..."
              className="text-sm resize-none min-h-[80px]"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSalvar} disabled={loading}>
            {loading ? "Salvando..." : "Salvar atividade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
