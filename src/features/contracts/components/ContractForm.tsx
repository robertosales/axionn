import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Check, Zap, Wrench, Shuffle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { DEFAULT_SLAS, ROOM_MODE_CONFIG } from '../types/contract';
import type { ContractFormData, SlaRow, RoomMode } from '../types/contract';
import { useSaveContract } from '../hooks/useContracts';
import { SlaMatrixEditor } from './SlaMatrixEditor';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Partial<ContractFormData & { id: string }>;
}

const EMPTY_FORM: ContractFormData = {
  name:        '',
  description: '',
  status:      'active',
  room_mode:   'sustentacao',
  starts_at:   '',
  ends_at:     '',
};

const ROOM_MODE_OPTIONS: { value: RoomMode; icon: React.ReactNode; label: string; desc: string }[] = [
  {
    value: 'agil',
    icon: <Zap className="h-4 w-4 text-blue-400" />,
    label: 'Sala Ágil',
    desc: 'Sprints, kanbans e HUs. SLA não aplicável.',
  },
  {
    value: 'sustentacao',
    icon: <Wrench className="h-4 w-4 text-purple-400" />,
    label: 'Sala de Sustentação',
    desc: 'Fila de chamados com SLA contratual obrigatório.',
  },
  {
    value: 'hibrido',
    icon: <Shuffle className="h-4 w-4 text-orange-400" />,
    label: 'Ágil + Sustentação',
    desc: 'Ambas as modalidades. SLA obrigatório para sustentação.',
  },
];

export function ContractForm({ onClose, onSuccess, initialData }: Props) {
  const [step, setStep]   = useState<1 | 2 | 3>(1);
  const [form, setForm]   = useState<ContractFormData>({ ...EMPTY_FORM, ...initialData });
  const [slas, setSlas]   = useState<SlaRow[]>(DEFAULT_SLAS);

  const { save, saving, error } = useSaveContract();

  const hasSLA      = ROOM_MODE_CONFIG[form.room_mode].hasSLA;  // RN03
  const totalSteps  = hasSLA ? 3 : 2;                           // Passo SLA só se sustentação
  const STEPS       = hasSLA
    ? ['1. Dados', '2. Modalidade', '3. SLAs']
    : ['1. Dados', '2. Modalidade'];

  function setField<K extends keyof ContractFormData>(key: K, value: ContractFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Valida SLA obrigatório (RN03): todos os campos preenchidos
  function slaValid(): boolean {
    if (!hasSLA) return true;
    return slas.every(s => s.response_time_minutes > 0 && s.resolution_time_minutes > 0);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Informe o nome do contrato'); return; }
    if (hasSLA && !slaValid()) {
      toast.error('Preencha todos os prazos da matriz de SLA antes de salvar.');
      return;
    }
    const slasToSave = hasSLA ? slas : [];
    const contractId = await save(form, slasToSave, initialData?.id);
    if (!contractId) { toast.error(error ?? 'Erro ao salvar'); return; }
    toast.success(initialData?.id ? 'Contrato atualizado!' : 'Contrato criado com sucesso!');
    onSuccess();
  }

  function handleNext() {
    if (step === 1 && !form.name.trim()) { toast.error('Informe o nome do contrato'); return; }
    // Se step 2 (modalidade) e não tem SLA, salva direto
    if (step === 2 && !hasSLA) { handleSave(); return; }
    setStep((s) => Math.min(s + 1, totalSteps) as any);
  }

  const isEditing  = !!initialData?.id;
  const step1Valid = form.name.trim().length >= 2;
  const isLastStep = hasSLA ? step === 3 : step === 2;

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

        {/* Passo 1 — Dados básicos */}
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

        {/* Passo 2 — Modalidade da sala (RN02) */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Selecione como este contrato será operado:
            </p>
            <div className="space-y-2">
              {ROOM_MODE_OPTIONS.map((opt) => {
                const active = form.room_mode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setField('room_mode', opt.value)}
                    className={[
                      'w-full flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all',
                      active
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border hover:bg-muted/40',
                    ].join(' ')}
                  >
                    <span className="mt-0.5">{opt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
                    </div>
                    {active && <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* RN03 — aviso condicional */}
            {hasSLA ? (
              <div className="flex items-start gap-2 rounded-lg bg-purple-950/40 border border-purple-800/50 px-3 py-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-400" />
                <p className="text-[11px] text-purple-300">
                  A matriz de SLA é <strong>obrigatória</strong> para esta modalidade.
                  O próximo passo solicitará os prazos de atendimento.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg bg-blue-950/40 border border-blue-800/50 px-3 py-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-400" />
                <p className="text-[11px] text-blue-300">
                  Modalidade ágil pura — <strong>SLA não aplicável</strong>.
                  O contrato será salvo sem matriz de prazos.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Passo 3 — Matriz SLA (só se hasSLA — RN03) */}
        {step === 3 && hasSLA && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Configure os prazos de atendimento do contrato.
              </p>
              <Badge variant="outline" className={ROOM_MODE_CONFIG[form.room_mode].className}>
                {ROOM_MODE_CONFIG[form.room_mode].icon} {ROOM_MODE_CONFIG[form.room_mode].label}
              </Badge>
            </div>
            {!slaValid() && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-destructive" />
                <p className="text-[11px] text-destructive">
                  Preencha todos os prazos antes de salvar. Campos com zero serão destacados.
                </p>
              </div>
            )}
            <div className="max-h-[42vh] overflow-y-auto pr-1">
              <SlaMatrixEditor slas={slas} onChange={setSlas} />
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => step === 1 ? onClose() : setStep((s) => (s - 1) as any)}
            disabled={saving}
          >
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </Button>

          {isLastStep ? (
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || !step1Valid || (hasSLA && !slaValid())}
            >
              {saving
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Salvando...</>
                : isEditing ? 'Salvar alterações' : 'Criar contrato'}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleNext}
              disabled={step === 1 ? !step1Valid : false}
            >
              {step === 2 && !hasSLA ? (
                saving
                  ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Salvando...</>
                  : 'Criar contrato'
              ) : 'Próximo'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
