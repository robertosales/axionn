import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: {
    nota_satisfacao: number;
    cobertura_testes: number;
    artefatos_atualizados: string;
    hard_code_identificado: boolean;
    reincidencia_defeito: boolean | null;
  }) => void;
  isCorretiva: boolean;
}

export function EncerramentoDialog({ open, onClose, onConfirm, isCorretiva }: Props) {
  const [nota, setNota] = useState('');
  const [cobertura, setCobertura] = useState('');
  const [artefatos, setArtefatos] = useState('');
  const [hardCode, setHardCode] = useState('');
  const [reincidencia, setReincidencia] = useState('');

  const handle = () => {
    const notaNum = parseInt(nota);
    const coberturaNum = parseFloat(cobertura);

    if (isNaN(notaNum) || notaNum < 0 || notaNum > 10) {
      toast.error("Informe a nota de satisfação (0 a 10).");
      return;
    }
    if (isNaN(coberturaNum) || coberturaNum < 0 || coberturaNum > 100) {
      toast.error("Informe a cobertura de testes (0% a 100%).");
      return;
    }
    if (!artefatos) {
      toast.error("Informe se os artefatos foram atualizados.");
      return;
    }
    if (!hardCode) {
      toast.error("Informe se há hard code identificado.");
      return;
    }
    if (isCorretiva && !reincidencia) {
      toast.error("Informe se há reincidência de defeito impeditivo.");
      return;
    }

    onConfirm({
      nota_satisfacao: notaNum,
      cobertura_testes: coberturaNum,
      artefatos_atualizados: artefatos,
      hard_code_identificado: hardCode === 'sim',
      reincidencia_defeito: isCorretiva ? reincidencia === 'sim' : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Encerramento da Demanda — Aceite Final</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* ISS */}
          <div>
            <Label htmlFor="closing-satisfaction">Nota de Satisfação do Serviço — ISS (0 a 10) <span className="text-destructive">*</span></Label>
            <Input id="closing-satisfaction" type="number" min={0} max={10} step={1} value={nota} onChange={e => setNota(e.target.value)} placeholder="0 a 10" className="mt-1 min-h-11" />
            <p className="text-[10px] text-muted-foreground mt-1">Preenchido pelo demandante ou gestor do produto.</p>
          </div>

          {/* ICT */}
          <div>
            <Label htmlFor="closing-coverage">Cobertura de Testes — ICT (%) <span className="text-destructive">*</span></Label>
            <Input id="closing-coverage" type="number" min={0} max={100} step={0.1} value={cobertura} onChange={e => setCobertura(e.target.value)} placeholder="0 a 100" className="mt-1 min-h-11" />
          </div>

          {/* Artefatos */}
          <div>
            <Label>Artefatos atualizados após a manutenção? <span className="text-destructive">*</span></Label>
              <RadioGroup value={artefatos} onValueChange={setArtefatos} className="mt-2 flex flex-wrap gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="sim" id="art-sim" /><Label htmlFor="art-sim" className="font-normal">Sim</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="nao" id="art-nao" /><Label htmlFor="art-nao" className="font-normal">Não</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="nao_aplica" id="art-na" /><Label htmlFor="art-na" className="font-normal">Não se aplica</Label></div>
            </RadioGroup>
            {artefatos === 'nao' && <p className="mt-1 flex items-start gap-1.5 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />Evento E5 será registrado (glosa 0,1%).</p>}
          </div>

          {/* Hard Code */}
          <div>
            <Label>Hard code identificado no código? <span className="text-destructive">*</span></Label>
            <RadioGroup value={hardCode} onValueChange={setHardCode} className="flex gap-4 mt-2">
              <div className="flex items-center gap-2"><RadioGroupItem value="sim" id="hc-sim" /><Label htmlFor="hc-sim" className="font-normal">Sim</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="nao" id="hc-nao" /><Label htmlFor="hc-nao" className="font-normal">Não</Label></div>
            </RadioGroup>
            {hardCode === 'sim' && <p className="mt-1 flex items-start gap-1.5 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />Evento E4 será registrado (glosa 0,1%).</p>}
          </div>

          {/* Reincidência (only corretiva) */}
          {isCorretiva && (
            <div>
              <Label>Reincidência de defeito impeditivo? <span className="text-destructive">*</span></Label>
              <RadioGroup value={reincidencia} onValueChange={setReincidencia} className="flex gap-4 mt-2">
                <div className="flex items-center gap-2"><RadioGroupItem value="sim" id="re-sim" /><Label htmlFor="re-sim" className="font-normal">Sim</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="nao" id="re-nao" /><Label htmlFor="re-nao" className="font-normal">Não</Label></div>
              </RadioGroup>
              {reincidencia === 'sim' && <p className="mt-1 flex items-start gap-1.5 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />Eventos E7 e E14 serão registrados (glosa 0,2% cada).</p>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="min-h-11 sm:min-h-9">Cancelar</Button>
          <Button onClick={handle} className="min-h-11 sm:min-h-9">Confirmar Encerramento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
