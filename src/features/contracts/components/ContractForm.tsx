import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { linkTeamToContract } from '../services/contracts.service';
import { DEFAULT_SLAS } from '../types/contract';
import type { ContractFormData, SlaRow, TeamConfig } from '../types/contract';
import { useSaveContract } from '../hooks/useContracts';
import { RoomBindingPanel } from './RoomBindingPanel';
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

export function ContractForm({ onClose, onSuccess, initialData }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<ContractFormData>({ ...EMPTY_FORM, ...initialData });
  const [slas, setSlas] = useState<SlaRow[]>(DEFAULT_SLAS);
  const [agileTeam, setAgileTeam] = useState<TeamConfig>({
    mode: 'link_existing',
    teamType: 'agile',
  });
  const [sustTeam, setSustTeam] = useState<TeamConfig>({
    mode: 'provision_new',
    teamType: 'sustenance',
  });

  const { save, saving, error } = useSaveContract();

  function setField<K extends keyof ContractFormData>(key: K, value: ContractFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Informe o nome do contrato');
      return;
    }

    const contractId = await save(form, slas, initialData?.id);
    if (!contractId) {
      toast.error(error ?? 'Erro ao salvar');
      return;
    }

    // Vincular times ao contrato
    const linkPromises: Promise<void>[] = [];

    if (agileTeam.mode === 'link_existing' && agileTeam.existingTeamId) {
      linkPromises.push(linkTeamToContract(agileTeam.existingTeamId, contractId, 'agile'));
    }
    if (sustTeam.mode === 'link_existing' && sustTeam.existingTeamId) {
      linkPromises.push(linkTeamToContract(sustTeam.existingTeamId, contractId, 'sustenance'));
    }

    await Promise.all(linkPromises);

    toast.success(
      initialData?.id ? 'Contrato atualizado!' : 'Contrato criado com sucesso!'
    );
    onSuccess();
  }

  const steps = ['1. Dados', '2. Times', '3. SLAs'];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">
            {initialData?.id ? 'Editar Contrato' : 'Novo Contrato'}
          </DialogTitle>

          {/* Stepper */}
          <div className="flex gap-2 mt-3">
            {steps.map((s, i) => (
              <button
                key={s}
                onClick={() => setStep((i + 1) as 1 | 2 | 3)}
                className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                  step === i + 1
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Step 1: Dados do contrato */}
          {step === 1 && (
            <>
              <div>
                <Label className="text-xs text-slate-400">Nome do Contrato *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  className="mt-1 bg-slate-950 border-slate-700 text-white placeholder:text-slate-600"
                  placeholder="Ex: Contrato Enterprise — TechCorp"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Descrição</Label>
                <Input
                  value={form.description ?? ''}
                  onChange={(e) => setField('description', e.target.value)}
                  className="mt-1 bg-slate-950 border-slate-700 text-white placeholder:text-slate-600"
                  placeholder="Detalhes do contrato..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-400">Início da Vigência</Label>
                  <Input
                    type="date"
                    value={form.starts_at ?? ''}
                    onChange={(e) => setField('starts_at', e.target.value)}
                    className="mt-1 bg-slate-950 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Fim da Vigência</Label>
                  <Input
                    type="date"
                    value={form.ends_at ?? ''}
                    onChange={(e) => setField('ends_at', e.target.value)}
                    className="mt-1 bg-slate-950 border-slate-700 text-white"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-400">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setField('status', v as any)}
                >
                  <SelectTrigger className="mt-1 bg-slate-950 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="paused">Pausado</SelectItem>
                    <SelectItem value="terminated">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Step 2: Vínculo de times */}
          {step === 2 && (
            <div className="space-y-4">
              <RoomBindingPanel
                title="⚡ Time Ágil"
                accentColor="indigo"
                config={agileTeam}
                onChange={setAgileTeam}
              />
              <RoomBindingPanel
                title="🛠 Time de Sustentação"
                accentColor="purple"
                config={sustTeam}
                onChange={setSustTeam}
              />
            </div>
          )}

          {/* Step 3: Matriz de SLA */}
          {step === 3 && <SlaMatrixEditor slas={slas} onChange={setSlas} />}
        </div>

        {/* Rodapé */}
        <div className="flex justify-between pt-4 border-t border-slate-800 mt-4">
          <Button
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <div className="flex gap-2">
            {step > 1 && (
              <Button
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => setStep((s) => (s - 1) as any)}
              >
                ← Voltar
              </Button>
            )}
            {step < 3 ? (
              <Button
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
                onClick={() => setStep((s) => (s + 1) as any)}
              >
                Próximo →
              </Button>
            ) : (
              <Button
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Salvando...' : 'Criar Contrato ✓'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
