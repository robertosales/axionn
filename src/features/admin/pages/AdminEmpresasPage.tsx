import { useState } from 'react';
import {
  Building2, CheckCircle2, FlaskConical, PauseCircle,
  LayoutGrid, Plus, Pencil, Trash2, ShieldCheck, X,
  ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useCompanies,
  type Company,
  type CompanyFormData,
  EMPTY_COMPANY_FORM,
} from '../hooks/useCompanies';
import {
  useLicenses,
  type LicenseFormData,
  EMPTY_LICENSE_FORM,
} from '../hooks/useLicenses';

// ── Status metadata ────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active:    { label: 'Ativa',     variant: 'default'     },
  trial:     { label: 'Trial',     variant: 'secondary'   },
  suspended: { label: 'Suspensa',  variant: 'destructive' },
  inactive:  { label: 'Inativa',   variant: 'outline'     },
};

const PLAN_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  starter:    { label: 'Starter',    variant: 'outline'   },
  pro:        { label: 'Pro',        variant: 'secondary' },
  enterprise: { label: 'Enterprise', variant: 'default'   },
};

// ── Company Form Dialog ────────────────────────────────────────────────────
function CompanyFormDialog({
  open,
  initial,
  onClose,
  onSave,
}: {
  open:    boolean;
  initial: CompanyFormData | null;
  onClose: () => void;
  onSave:  (data: CompanyFormData) => Promise<boolean>;
}) {
  const [form, setForm] = useState<CompanyFormData>(initial ?? EMPTY_COMPANY_FORM);
  const [saving, setSaving] = useState(false);

  // reset ao abrir
  useState(() => { setForm(initial ?? EMPTY_COMPANY_FORM); });

  const set = (k: keyof CompanyFormData, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const ok = await onSave(form);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Nome *</Label>
            <Input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Nome da empresa"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CNPJ</Label>
            <Input
              value={form.cnpj}
              onChange={e => set('cnpj', e.target.value)}
              placeholder="00.000.000/0001-00"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">E-mail</Label>
              <Input
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="contato@empresa.com"
                type="email"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="(11) 00000-0000"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL do Logo</Label>
            <Input
              value={form.logo_url}
              onChange={e => set('logo_url', e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativa</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="suspended">Suspensa</SelectItem>
                <SelectItem value="inactive">Inativa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── License Panel (inline accordion) ──────────────────────────────────────
function LicensePanel({ companyId }: { companyId: string }) {
  const { license, loading, upsert } = useLicenses(companyId);
  const [form, setForm] = useState<LicenseFormData>(EMPTY_LICENSE_FORM);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof LicenseFormData, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleEdit = () => {
    setForm(license ? {
      plan:           license.plan,
      pf_quota_month: license.pf_quota_month != null ? String(license.pf_quota_month) : '',
      ai_calls_quota: license.ai_calls_quota != null ? String(license.ai_calls_quota) : '',
      valid_until:    license.valid_until,
      status:         license.status,
    } : EMPTY_LICENSE_FORM);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const ok = await upsert(form);
    setSaving(false);
    if (ok) setEditing(false);
  };

  if (loading) return <Skeleton className="h-10 w-full rounded-md" />;

  if (!editing && !license) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>Sem licença cadastrada</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs px-2 ml-auto" onClick={handleEdit}>
          <Plus className="h-3 w-3 mr-1" /> Criar licença
        </Button>
      </div>
    );
  }

  if (!editing && license) {
    const planMeta = PLAN_META[license.plan] ?? PLAN_META.starter;
    const pctPf = license.pf_quota_month
      ? Math.min(100, Math.round((license.pf_used_month / license.pf_quota_month) * 100))
      : null;
    const pctAi = license.ai_calls_quota
      ? Math.min(100, Math.round((license.ai_calls_used / license.ai_calls_quota) * 100))
      : null;

    return (
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={planMeta.variant} className="text-[11px]">{planMeta.label}</Badge>
        {pctPf !== null && (
          <span className="text-[11px] text-muted-foreground">
            PF: {license.pf_used_month}/{license.pf_quota_month} ({pctPf}%)
          </span>
        )}
        {pctAi !== null && (
          <span className="text-[11px] text-muted-foreground">
            IA: {license.ai_calls_used}/{license.ai_calls_quota} ({pctAi}%)
          </span>
        )}
        <span className="text-[11px] text-muted-foreground">
          Válida até {new Date(license.valid_until).toLocaleDateString('pt-BR')}
        </span>
        <Button
          variant="ghost" size="sm"
          className="h-6 text-xs px-2 ml-auto"
          onClick={handleEdit}
        >
          <Pencil className="h-3 w-3 mr-1" /> Editar licença
        </Button>
      </div>
    );
  }

  // editing form inline
  return (
    <div className="space-y-3 pt-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Plano</Label>
          <Select value={form.plan} onValueChange={v => set('plan', v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="expired">Expirado</SelectItem>
              <SelectItem value="suspended">Suspenso</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Cota PF/mês</Label>
          <Input
            className="h-8 text-xs"
            value={form.pf_quota_month}
            onChange={e => set('pf_quota_month', e.target.value)}
            placeholder="ilimitado"
            type="number"
            min={0}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cota IA/mês</Label>
          <Input
            className="h-8 text-xs"
            value={form.ai_calls_quota}
            onChange={e => set('ai_calls_quota', e.target.value)}
            placeholder="ilimitado"
            type="number"
            min={0}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Válida até</Label>
          <Input
            className="h-8 text-xs"
            value={form.valid_until}
            onChange={e => set('valid_until', e.target.value)}
            type="date"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(false)} disabled={saving}>
          <X className="h-3 w-3 mr-1" /> Cancelar
        </Button>
        <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          Salvar licença
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export function AdminEmpresasPage() {
  const { companies, loading, kpis, create, update, remove } = useCompanies();

  const [formOpen,     setFormOpen]     = useState(false);
  const [editingData,  setEditingData]  = useState<CompanyFormData | null>(null);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  const handleNew = () => {
    setEditingId(null);
    setEditingData(null);
    setFormOpen(true);
  };

  const handleEdit = (company: Company) => {
    setEditingId(company.id);
    setEditingData({
      name:     company.name,
      cnpj:     company.cnpj     ?? '',
      email:    company.email    ?? '',
      phone:    company.phone    ?? '',
      logo_url: company.logo_url ?? '',
      status:   company.status,
    });
    setFormOpen(true);
  };

  const handleSave = async (data: CompanyFormData): Promise<boolean> => {
    if (editingId) return update(editingId, data);
    return create(data);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    setDeleteTarget(null);
  };

  const toggleExpand = (id: string) =>
    setExpandedId(prev => (prev === id ? null : id));

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Empresas</h2>
          <p className="text-xs text-muted-foreground">
            {loading
              ? 'Carregando...'
              : `${kpis.total} empresa${kpis.total !== 1 ? 's' : ''} cadastrada${kpis.total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={handleNew}>
          <Plus className="h-4 w-4" /> Nova Empresa
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <CheckCircle2 className="h-4 w-4" />,  label: 'Ativas',    value: kpis.active    },
          { icon: <FlaskConical  className="h-4 w-4" />,  label: 'Trial',     value: kpis.trial     },
          { icon: <PauseCircle   className="h-4 w-4" />,  label: 'Suspensas', value: kpis.suspended },
          { icon: <LayoutGrid    className="h-4 w-4" />,  label: 'Total',     value: kpis.total     },
        ].map(({ icon, label, value }) => (
          <div key={label} className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
              {icon}
              <span>{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">Empresas</span>
          <Badge variant="secondary" className="text-xs">{kpis.total}</Badge>
        </div>

        {loading ? (
          <Skeleton className="h-48 w-full rounded-b-lg" />
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Building2 className="h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhuma empresa cadastrada.</p>
            <Button size="sm" variant="outline" onClick={handleNew}>
              <Plus className="h-4 w-4 mr-1" /> Criar primeira empresa
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {companies.map(company => {
              const meta = STATUS_META[company.status] ?? STATUS_META.inactive;
              const isExpanded = expandedId === company.id;
              return (
                <div key={company.id}>
                  {/* Row principal */}
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Logo ou ícone */}
                      {company.logo_url ? (
                        <img
                          src={company.logo_url}
                          alt={company.name}
                          className="h-7 w-7 rounded-md object-cover shrink-0 border"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{company.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {company.cnpj && (
                            <span className="text-[11px] text-muted-foreground">
                              CNPJ: {company.cnpj}
                            </span>
                          )}
                          {(company.teamCount ?? 0) > 0 && (
                            <span className="text-[11px] text-muted-foreground">
                              · {company.teamCount} time{company.teamCount! > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={meta.variant} className="text-[11px]">
                        {meta.label}
                      </Badge>
                      {/* Toggle licença */}
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7"
                        title="Gerenciar licença"
                        onClick={() => toggleExpand(company.id)}
                      >
                        {isExpanded
                          ? <ChevronUp   className="h-3.5 w-3.5" />
                          : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEdit(company)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(company)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Painel de licença (accordion) */}
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 bg-muted/20 border-t">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Licença SaaS
                      </p>
                      <LicensePanel companyId={company.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Company Form Dialog */}
      <CompanyFormDialog
        open={formOpen}
        initial={editingData}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />

      {/* Confirm Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              A empresa <strong>{deleteTarget?.name}</strong> será excluída permanentemente.
              Os times vinculados <strong>não serão excluídos</strong>, apenas desvinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
