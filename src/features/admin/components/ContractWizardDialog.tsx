import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  type ContractFormData, type ContractSla, type SlaType,
  EMPTY_FORM,
} from "../hooks/useContracts";

interface Props {
  open: boolean;
  contractId?: string | null;
  initialData?: ContractFormData | null;
  onClose: () => void;
  onSave: (data: ContractFormData) => Promise<boolean>;
}

const STEPS = ["1. Dados", "2. Projetos", "3. SLAs"];

const STATUS_OPTIONS = [
  { value: "active",    label: "Ativo"     },
  { value: "paused",    label: "Pausado"   },
  { value: "expired",   label: "Expirado"  },
  { value: "cancelled", label: "Cancelado" },
];

const SLA_TYPE_OPTIONS: { value: SlaType; label: string }[] = [
  { value: "24x7",           label: "24x7"               },
  { value: "business_hours", label: "Horário Comercial"  },
  { value: "custom",         label: "Personalizado"      },
];

const CRITICIDADE_LABELS: Record<string, string> = {
  baixa:   "Baixa",
  media:   "Média",
  alta:    "Alta",
  critica: "Crítica",
};

interface ProjectOption {
  id: string;
  name: string;
  contract_id: string | null;
}

export function ContractWizardDialog({ open, contractId, initialData, onClose, onSave }: Props) {
  const [step,            setStep]            = useState(0);
  const [form,            setForm]            = useState<ContractFormData>({ ...EMPTY_FORM });
  const [saving,          setSaving]          = useState(false);
  const [projects,        setProjects]        = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setForm(initialData ? { ...initialData } : { ...EMPTY_FORM });
    }
  }, [open, initialData]);

  useEffect(() => {
    if (open && step === 1) {
      setLoadingProjects(true);
      supabase
        .from("projects")
        .select("id, name, contract_id")
        .order("name")
        .then(({ data }) => {
          setProjects((data || []) as ProjectOption[]);
          setLoadingProjects(false);
        });
    }
  }, [open, step]);

  const set = (field: keyof ContractFormData, value: any) =>
    setForm(p => ({ ...p, [field]: value }));

  const step1Valid = form.name.trim().length >= 2;

  const toggleProject = (id: string) =>
    set("project_ids",
      form.project_ids.includes(id)
        ? form.project_ids.filter(p => p !== id)
        : [...form.project_ids, id]
    );

  const availableProjects = projects.filter(
    p => !p.contract_id || p.contract_id === contractId || form.project_ids.includes(p.id)
  );

  const updateSla = (idx: number, field: keyof ContractSla, value: any) => {
    const slas = [...form.slas];
    slas[idx] = { ...slas[idx], [field]: value };
    set("slas", slas);
  };

  const handleSave = async () => {
    if (!step1Valid) return;
    setSaving(true);
    const ok = await onSave(form);
    setSaving(false);
    if (ok) onClose();
  };

  const isEditing = !!contractId;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex gap-1">
          {STEPS.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => i < step ? setStep(i) : undefined}
              disabled={i > step}
              className={[
                "flex-1 py-1.5 px-2 text-xs font-medium rounded transition-colors",
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                  ? "bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer"
                  : "bg-muted/40 text-muted-foreground/50 cursor-default",
              ].join(" ")}
            >
              {i < step && <Check className="inline h-3 w-3 mr-1" />}
              {label}
            </button>
          ))}
        </div>

        {/* STEP 1 */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do Contrato <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={e => set("name", e.target.value)}
                placeholder="Ex: Contrato Enterprise — TechCorp"
                maxLength={120}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={e => set("description", e.target.value)}
                placeholder="Detalhes do contrato..."
                className="resize-none"
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início da Vigência</Label>
                <Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fim da Vigência</Label>
                <Input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} min={form.start_date} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Selecione os projetos que pertencem a este contrato.
            </p>
            {loadingProjects ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : availableProjects.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">Nenhum projeto disponível.</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {availableProjects.map(p => {
                  const selected = form.project_ids.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProject(p.id)}
                      className={[
                        "w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-colors text-left",
                        selected
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      <span className="font-medium">{p.name}</span>
                      {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}
            {form.project_ids.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {form.project_ids.length} projeto{form.project_ids.length > 1 ? "s" : ""} selecionado{form.project_ids.length > 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {/* STEP 3 */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Configure os tempos de resposta e resolução por criticidade (em minutos).
            </p>
            <div className="space-y-2">
              {form.slas.map((sla, idx) => (
                <div key={sla.criticidade} className="rounded-md border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-xs">{CRITICIDADE_LABELS[sla.criticidade]}</Badge>
                    <Select value={sla.sla_type} onValueChange={v => updateSla(idx, "sla_type", v as SlaType)}>
                      <SelectTrigger className="h-7 w-44 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SLA_TYPE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Resposta (min)</Label>
                      <Input type="number" min={1} value={sla.response_time_minutes}
                        onChange={e => updateSla(idx, "response_time_minutes", Number(e.target.value))}
                        className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Resolução (min)</Label>
                      <Input type="number" min={1} value={sla.resolution_time_minutes}
                        onChange={e => updateSla(idx, "resolution_time_minutes", Number(e.target.value))}
                        className="h-8 text-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">60 min = 1h · 480 min = 8h · 1440 min = 24h</p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => step === 0 ? onClose() : setStep(s => s - 1)} disabled={saving}>
            {step === 0 ? "Cancelar" : "Voltar"}
          </Button>
          {step < 2 ? (
            <Button type="button" onClick={() => setStep(s => s + 1)} disabled={step === 0 && !step1Valid}>
              Próximo
            </Button>
          ) : (
            <Button type="button" onClick={handleSave} disabled={saving || !step1Valid}>
              {saving
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Salvando...</>
                : isEditing ? "Salvar alterações" : "Criar contrato"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
