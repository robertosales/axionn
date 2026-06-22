import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox }  from '@/components/ui/checkbox';
import { Skeleton }  from '@/components/ui/skeleton';
import { Badge }     from '@/components/ui/badge';
import { Loader2 }   from 'lucide-react';
import { useTeamsAdmin }   from '../hooks/useTeamsAdmin';
import { useCompanies }    from '../hooks/useCompanies';
import { useProjetosAdmin } from '../hooks/useProjetosAdmin';
import {
  type ContractFormData,
  EMPTY_CONTRACT_FORM,
} from '../hooks/useContracts';

// ── helpers ────────────────────────────────────────────────────────────────

const STEPS = ['Dados gerais', 'Times & Projetos', 'SLAs'] as const;
type Step = 0 | 1 | 2;

const NO_COMPANY = '__none__';
const CURRENCIES = ['BRL', 'USD', 'EUR'];

function toggle(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
}

// ── Component ─────────────────────────────────────────────────────────────

interface Props {
  open:        boolean;
  contractId:  string | null;
  initialData: ContractFormData | null;
  onClose:     () => void;
  onSave:      (data: ContractFormData) => Promise<boolean>;
}

export function ContractWizardDialog({
  open, contractId, initialData, onClose, onSave,
}: Props) {
  const [step,   setStep]   = useState<Step>(0);
  const [form,   setForm]   = useState<ContractFormData>(EMPTY_CONTRACT_FORM);
  const [saving, setSaving] = useState(false);

  const { teams,     loading: loadingTeams }     = useTeamsAdmin();
  const { companies, loading: loadingCompanies } = useCompanies();
  const { projetos,  loading: loadingProjects }  = useProjetosAdmin();

  useEffect(() => {
    if (open) {
      setStep(0);
      setForm(initialData ?? EMPTY_CONTRACT_FORM);
    }
  }, [open, initialData]);

  const set = <K extends keyof ContractFormData>(k: K, v: ContractFormData[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const ok = await onSave(form);
    setSaving(false);
    if (ok) onClose();
  };

  // ── Step 0 — Dados gerais ──────────────────────────────────────────────
  const renderStep0 = () => (
    <div className="space-y-3">

      {/* Nome */}
      <div className="space-y-1">
        <Label className="text-xs">Nome do contrato *</Label>
        <Input
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="Ex: Contrato APF GlobalWeb 2025"
        />
      </div>

      {/* Número do contrato + Moeda */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Número do contrato</Label>
          <Input
            value={form.number}
            onChange={e => set('number', e.target.value)}
            placeholder="Ex: 2025/0042"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Moeda</Label>
          <Select value={form.currency} onValueChange={v => set('currency', v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Objeto */}
      <div className="space-y-1">
        <Label className="text-xs">Objeto / descrição</Label>
        <Textarea
          value={form.object}
          onChange={e => set('object', e.target.value)}
          placeholder="Descreva o objeto do contrato..."
          rows={3}
          className="text-sm resize-none"
        />
      </div>

      {/* Valor por PF-US + Empresa */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Valor por PF-US ({form.currency})</Label>
          <Input
            value={form.value_per_pfus}
            onChange={e => set('value_per_pfus', e.target.value)}
            placeholder="Ex: 1250.00"
            type="number"
            min={0}
            step="0.01"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Empresa cliente</Label>
          {loadingCompanies ? (
            <Skeleton className="h-9 w-full rounded-md" />
          ) : (
            <Select
              value={form.company_id ?? NO_COMPANY}
              onValueChange={v => set('company_id', v === NO_COMPANY ? null : v)}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Sem empresa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COMPANY}>— Sem empresa —</SelectItem>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Status + datas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="paused">Pausado</SelectItem>
              <SelectItem value="expired">Expirado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Início</Label>
          <Input
            value={form.start_date}
            onChange={e => set('start_date', e.target.value)}
            type="date"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Término</Label>
          <Input
            value={form.end_date}
            onChange={e => set('end_date', e.target.value)}
            type="date"
            className="h-9 text-sm"
          />
        </div>
      </div>
    </div>
  );

  // ── Step 1 — Times & Projetos ─────────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-4">

      {/* Times */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Times</p>
        {loadingTeams ? <Skeleton className="h-24 w-full rounded-md" /> : (
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {teams.map(t => (
              <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={form.team_ids.includes(t.id)}
                  onCheckedChange={() => set('team_ids', toggle(form.team_ids, t.id))}
                />
                <span className="text-sm">{t.name}</span>
                {t.memberCount !== undefined && (
                  <Badge variant="secondary" className="text-[10px] ml-auto">
                    {t.memberCount} membro{t.memberCount !== 1 ? 's' : ''}
                  </Badge>
                )}
              </label>
            ))}
            {teams.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum time cadastrado.</p>
            )}
          </div>
        )}
      </div>

      {/* Projetos */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Projetos</p>
        {loadingProjects ? <Skeleton className="h-24 w-full rounded-md" /> : (
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {projetos.map((p: any) => (
              <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={form.project_ids.includes(p.id)}
                  onCheckedChange={() => set('project_ids', toggle(form.project_ids, p.id))}
                />
                <span className="text-sm">{p.name}</span>
              </label>
            ))}
            {projetos.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum projeto cadastrado.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ── Step 2 — SLAs ────────────────────────────────────────────────────
  const renderStep2 = () => (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Gerencie os SLAs diretamente na aba de SLAs após salvar o contrato.
      </p>
      {(form.sla_ids.length > 0) && (
        <p className="text-xs text-muted-foreground">
          {form.sla_ids.length} SLA{form.sla_ids.length > 1 ? 's' : ''} vinculado{form.sla_ids.length > 1 ? 's' : ''}.
        </p>
      )}
    </div>
  );

  // ── render ────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {contractId ? 'Editar Contrato' : 'Novo Contrato'}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-1 mb-1">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i as Step)}
              className={[
                'flex-1 py-1 rounded text-[11px] font-medium transition-colors',
                i === step
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="py-2 min-h-[220px]">
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => step > 0 ? setStep((step - 1) as Step) : onClose()}
            disabled={saving}
          >
            {step === 0 ? 'Cancelar' : '← Anterior'}
          </Button>
          {step < 2 ? (
            <Button
              size="sm"
              onClick={() => setStep((step + 1) as Step)}
              disabled={step === 0 && !form.name.trim()}
            >
              Próximo →
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Salvar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
