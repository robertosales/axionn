import { useState, useEffect, useMemo } from 'react';
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
import { Loader2, Users, FolderOpen, Search } from 'lucide-react';
import { useTeamsAdmin }    from '../hooks/useTeamsAdmin';
import { useCompanies }     from '../hooks/useCompanies';
import { useProjetosAdmin } from '../hooks/useProjetosAdmin';
import {
  type ContractFormData,
  EMPTY_CONTRACT_FORM,
} from '../hooks/useContracts';

// ── helpers ─────────────────────────────────────────────────────────────
const STEPS    = ['Dados gerais', 'Times & Projetos', 'SLAs'] as const;
type  Step     = 0 | 1 | 2;
const NO_COMPANY  = '__none__';
const CURRENCIES  = ['BRL', 'USD', 'EUR'];

function toggle(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
}

// ── Sub-componente: seção selecionável com busca e marca-todos ──────────
interface SelectSectionProps {
  icon:       React.ReactNode;
  title:      string;
  loading:    boolean;
  items:      { id: string; label: string; sub?: string }[];
  selected:   string[];
  onChange:   (ids: string[]) => void;
  emptyText?: string;
}

function SelectSection({
  icon, title, loading, items, selected, onChange, emptyText,
}: SelectSectionProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => items.filter(i => i.label.toLowerCase().includes(search.toLowerCase())),
    [items, search],
  );

  const allFilteredIds  = filtered.map(i => i.id);
  const allSelected     = filtered.length > 0 && allFilteredIds.every(id => selected.includes(id));
  const someSelected    = allFilteredIds.some(id => selected.includes(id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      // desmarca todos os visíveis
      onChange(selected.filter(id => !allFilteredIds.includes(id)));
    } else {
      // marca todos os visíveis sem duplicar
      onChange([...new Set([...selected, ...allFilteredIds])]);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide flex-1">{title}</span>
        {loading ? (
          <Skeleton className="h-4 w-16 rounded" />
        ) : (
          <Badge variant="secondary" className="text-[10px]">
            {selected.filter(id => items.some(i => i.id === id)).length}/{items.length}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="p-3 space-y-2">
          {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full rounded" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground px-3 py-4 text-center">
          {emptyText ?? 'Nenhum item cadastrado.'}
        </p>
      ) : (
        <div className="p-2 space-y-1.5">

          {/* Busca + Marca todos */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filtrar..."
                className="h-7 pl-6 text-xs"
              />
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
              <Checkbox
                checked={allSelected}
                // indeterminate via data-attr para o Radix Checkbox
                data-state={someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked'}
                onCheckedChange={toggleAll}
                className="h-3.5 w-3.5"
              />
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">Marcar todos</span>
            </label>
          </div>

          {/* Lista */}
          <div className="max-h-44 overflow-y-auto space-y-0.5 pr-0.5">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground py-2 text-center">Nenhum resultado.</p>
            )}
            {filtered.map(item => {
              const checked = selected.includes(item.id);
              return (
                <label
                  key={item.id}
                  className={[
                    'flex items-center gap-2.5 px-2 py-1.5 rounded cursor-pointer transition-colors',
                    checked
                      ? 'bg-primary/8 hover:bg-primary/12'
                      : 'hover:bg-muted/50',
                  ].join(' ')}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => onChange(toggle(selected, item.id))}
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  <span className="text-sm flex-1 leading-tight">{item.label}</span>
                  {item.sub && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {item.sub}
                    </Badge>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Component principal ─────────────────────────────────────────────────
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
      <div className="space-y-1">
        <Label className="text-xs">Nome do contrato *</Label>
        <Input
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="Ex: Contrato APF GlobalWeb 2025"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Número do contrato</Label>
          <Input
            value={form.number}
            onChange={e => set('number', e.target.value)}
            placeholder="Ex: 2026/0042"
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
          <Input value={form.start_date} onChange={e => set('start_date', e.target.value)} type="date" className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Término</Label>
          <Input value={form.end_date} onChange={e => set('end_date', e.target.value)} type="date" className="h-9 text-sm" />
        </div>
      </div>
    </div>
  );

  // ── Step 1 — Times & Projetos ─────────────────────────────────────────
  const teamItems    = teams.map(t => ({
    id:    t.id,
    label: t.name,
    sub:   t.memberCount !== undefined
      ? `${t.memberCount} membro${t.memberCount !== 1 ? 's' : ''}`
      : undefined,
  }));

  const projetoItems = (projetos as any[]).map(p => ({
    id:    p.id,
    label: p.name,
  }));

  const renderStep1 = () => (
    <div className="space-y-3">
      <SelectSection
        icon={<Users className="h-3.5 w-3.5" />}
        title="Times"
        loading={loadingTeams}
        items={teamItems}
        selected={form.team_ids}
        onChange={ids => set('team_ids', ids)}
        emptyText="Nenhum time cadastrado."
      />
      <SelectSection
        icon={<FolderOpen className="h-3.5 w-3.5" />}
        title="Projetos"
        loading={loadingProjects}
        items={projetoItems}
        selected={form.project_ids}
        onChange={ids => set('project_ids', ids)}
        emptyText="Nenhum projeto cadastrado."
      />
    </div>
  );

  // ── Step 2 — SLAs ────────────────────────────────────────────────────
  const renderStep2 = () => (
    <div className="space-y-2 py-2">
      <p className="text-xs text-muted-foreground">
        Gerencie os SLAs diretamente na aba de SLAs após salvar o contrato.
      </p>
      {form.sla_ids.length > 0 && (
        <Badge variant="secondary">
          {form.sla_ids.length} SLA{form.sla_ids.length > 1 ? 's' : ''} vinculado{form.sla_ids.length > 1 ? 's' : ''}
        </Badge>
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
        <div className="flex gap-1">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i as Step)}
              className={[
                'flex-1 py-1.5 rounded text-[11px] font-medium transition-colors',
                i === step
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="py-1 min-h-[260px]">
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
