import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { DEFAULT_SLAS } from '../types/contract';
import type { ContractFormData, SlaRow } from '../types/contract';
import { useSaveContract } from '../hooks/useContracts';
import { SlaMatrixEditor } from './SlaMatrixEditor';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Partial<ContractFormData & { id: string }>;
}

const EMPTY_FORM: ContractFormData = {
  name: '',
  description: '',
  status: 'active',
  starts_at: '',
  ends_at: '',
};

const STEPS = ['1. Dados', '2. SLAs'];

export function ContractForm({ onClose, onSuccess, initialData }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<ContractFormData>({ ...EMPTY_FORM, ...initialData });
  const [slas, setSlas] = useState<SlaRow[]>(DEFAULT_SLAS);

  const { save, saving, error } = useSaveContract();

  function setField<K extends keyof ContractFormData>(key: K, value: ContractFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Informe o nome do contrato'); return; }

    const contractId = await save(form, slas, initialData?.id);
    if (!contractId) { toast.error(error ?? 'Erro ao salvar'); return; }

    toast.success(initialData?.id ? 'Contrato atualizado!' : 'Contrato criado com sucesso!');
    onSuccess();
  }

  const isEditing  = !!initialData?.id;
  const step1Valid = form.name.trim().length >= 2;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Contrato' : 'Novo Contrato'}</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex rounded-md overflow-hidden border">
          {STEPS.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => i + 1 < step ? setStep((i + 1) as any) : undefined}
              disabled={i + 1 > step}
              className={[
                'flex-1 py-2 text-xs font-medium transition-colors border-r last:border-r-0',
                step === i + 1
                  ? 'bg-primary text-primary-foreground'
                  : i + 1 < step
                  ? 'bg-muted/60 text-muted-foreground hover:bg-muted cursor-pointer'
                  : 'bg-muted/20 text-muted-foreground/40 cursor-default',
              ].join(' ')}
            >
              {i + 1 < step && <Check className="inline h-3 w-3 mr-1" />}
              {s}
            </button>
          ))}
        </div>

        {/* Step 1 — Dados */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do Contrato <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Ex: Contrato Fábrica — TechCorp 2026"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                value={form.description ?? ''}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Detalhes do contrato..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início da Vigência</Label>
                <Input
                  type="date"
                  value={form.starts_at ?? ''}
                  onChange={(e) => setField('starts_at', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fim da Vigência</Label>
                <Input
                  type="date"
                  value={form.ends_at ?? ''}
                  onChange={(e) => setField('ends_at', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setField('status', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="terminated">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Step 2 — SLAs */}
        {step === 2 && (
          <div className="max-h-[50vh] overflow-y-auto pr-1">
            <SlaMatrixEditor slas={slas} onChange={setSlas} />
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => step === 1 ? onClose() : setStep(1)}
            disabled={saving}
          >
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </Button>
          {step < 2 ? (
            <Button
              type="button"
              onClick={() => setStep(2)}
              disabled={!step1Valid}
            >
              Próximo
            </Button>
          ) : (
            <Button type="button" onClick={handleSave} disabled={saving || !step1Valid}>
              {saving
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Salvando...</>
                : isEditing ? 'Salvar alterações' : 'Criar contrato'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
