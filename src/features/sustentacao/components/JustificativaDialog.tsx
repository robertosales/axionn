import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (justificativa: string) => Promise<void>;
}

export function JustificativaDialog({ open, onClose, onConfirm }: Props) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!text.trim()) return;
    setLoading(true);
    await onConfirm(text.trim());
    setText('');
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setText(''); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Justificativa obrigatória</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="status-justification">Informe a justificativa para esta mudança de status:</Label>
          <Textarea id="status-justification" value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Descreva o motivo..." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="min-h-11 sm:min-h-9">Cancelar</Button>
          <Button onClick={handle} disabled={!text.trim() || loading} className="min-h-11 sm:min-h-9">{loading ? 'Salvando...' : 'Confirmar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
