import { useState } from "react";
import { Target, TrendingUp, AlertTriangle, CheckCircle, ChevronDown, Pencil, Trash2, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OkrCheckInInput, OkrObjective, OkrKeyResult } from "../types";
import { OkrKeyResultRow } from "./OkrKeyResultRow";
import { OkrCheckInModal } from "./OkrCheckInModal";
import { krProgressColor } from "./OkrKeyResultRow";
import { OKR_METRIC_CATALOG } from "../domain/metricCatalog";
import { OkrHistoryDialog } from "./OkrHistoryDialog";
import { OkrInitiativesPanel } from "./OkrInitiativesPanel";

const STATUS_CONFIG = {
  on_track:  { label: "No Prazo",  color: "bg-emerald-500/15 text-emerald-600 border-emerald-200", icon: <TrendingUp className="h-3 w-3" /> },
  at_risk:   { label: "Em Risco",  color: "bg-amber-400/15 text-amber-600 border-amber-200", icon: <AlertTriangle className="h-3 w-3" /> },
  off_track: { label: "Atrasado",  color: "bg-red-500/15 text-red-600 border-red-200", icon: <AlertTriangle className="h-3 w-3" /> },
  completed: { label: "Concluído", color: "bg-blue-500/15 text-blue-600 border-blue-200", icon: <CheckCircle className="h-3 w-3" /> },
};

const UNIT_OPTIONS: { value: OkrKeyResult["unit"]; label: string; hint: string }[] = [
  { value: "%",    label: "Porcentagem (%)",  hint: "Ex: aumentar entregas para 80%" },
  { value: "un",   label: "Número (contagem)", hint: "Ex: máximo 5 HUs voltando ao backlog" },
  { value: "pts",  label: "Pontuação (pts)",   hint: "Ex: NPS de 7 para 9" },
  { value: "score",label: "Score",             hint: "Ex: nota de qualidade 7/10" },
  { value: "dias", label: "Dias",              hint: "Ex: reduzir ciclo para 3 dias" },
  { value: "R$",   label: "Valor (R$)",        hint: "Ex: reduzir custo para R$ 5.000" },
  { value: "bool", label: "Sim / Não",         hint: "Algo que será feito ou não" },
  { value: "bugs", label: "Bugs",              hint: "Ex: reduzir para menos de 5 bugs" },
];

interface Props {
  objective: OkrObjective;
  onCheckIn: (krId: string, input: OkrCheckInInput) => void;
  onRefreshKeyResult?: (krId: string) => Promise<void>;
  onEdit?: (objective: OkrObjective) => void;
  onDelete?: (id: string) => Promise<void>;
  onAddKeyResult?: (kr: { objective_id: string; title: string; unit: OkrKeyResult["unit"]; baseline: number; target: number; direction: OkrKeyResult["direction"]; update_type: OkrKeyResult["update_type"]; metric_code?: string | null }) => Promise<void>;
  onUpdateKeyResult?: (id: string, payload: { title?: string; unit?: OkrKeyResult["unit"]; target?: number }) => Promise<void>;
  onDeleteKeyResult?: (id: string) => Promise<void>;
}

export function OkrObjectiveCard({ objective: obj, onCheckIn, onRefreshKeyResult, onEdit, onDelete, onAddKeyResult, onUpdateKeyResult, onDeleteKeyResult }: Props) {
  const [expanded, setExpanded]         = useState(false);
  const [checkInKr, setCheckInKr]       = useState<OkrKeyResult | null>(null);
  const [historyKr, setHistoryKr]       = useState<OkrKeyResult | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting]     = useState(false);
  const [showKrForm, setShowKrForm]     = useState(false);
  const [krTitle, setKrTitle]           = useState("");
  const [krUnit, setKrUnit]             = useState<OkrKeyResult["unit"]>("%");
  const [krTarget, setKrTarget]         = useState("");
  const [krBaseline, setKrBaseline]     = useState("");
  const [krDirection, setKrDirection]   = useState<OkrKeyResult["direction"]>("increase");
  const [krUpdateType, setKrUpdateType] = useState<OkrKeyResult["update_type"]>("manual");
  const [krMetricCode, setKrMetricCode] = useState("");
  const [isSavingKr, setIsSavingKr]     = useState(false);

  const status = STATUS_CONFIG[obj.status];
  const selectedUnit = UNIT_OPTIONS.find((u) => u.value === krUnit);

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try { await onDelete(obj.id); }
    finally { setIsDeleting(false); setConfirmDelete(false); }
  };

  const handleAddKr = async () => {
    if (!onAddKeyResult || !krTitle.trim() || !krBaseline || (krUnit !== "bool" && !krTarget)) return;
    setIsSavingKr(true);
    try {
      await onAddKeyResult({ objective_id: obj.id, title: krTitle.trim(), unit: krUnit, baseline: Number(krBaseline), target: krUnit === "bool" ? 1 : Number(krTarget), direction: krDirection, update_type: krUpdateType, metric_code: krMetricCode || null });
      setKrTitle(""); setKrUnit("%"); setKrTarget(""); setShowKrForm(false);
    } finally { setIsSavingKr(false); }
  };

  const handleCancelKr = () => { setShowKrForm(false); setKrTitle(""); setKrUnit("%"); setKrTarget(""); };

  return (
    <>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden transition-shadow hover:shadow-md">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Target className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-snug">{obj.title}</p>
                {obj.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{obj.description}</p>}
                <p className="text-[11px] text-muted-foreground mt-1">{obj.team_name} · {obj.owner_name} · {obj.cycle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onEdit && (
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => onEdit(obj)}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
              )}
              {onDelete && !confirmDelete && (
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
              )}
              {confirmDelete && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-destructive font-medium">Confirmar?</span>
                  <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? <span className="flex items-center gap-1"><span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />Excluindo...</span> : "Sim, excluir"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setConfirmDelete(false)} disabled={isDeleting}>Cancelar</Button>
                </div>
              )}
              <Badge className={cn("text-[10px] gap-1 shrink-0 border", status.color)}>{status.icon} {status.label}</Badge>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Progresso geral</span>
              <span className="text-sm font-bold text-foreground">{obj.progress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className={cn("h-2 rounded-full transition-all duration-500", krProgressColor(obj.progress))} style={{ width: `${obj.progress}%` }} />
            </div>
            <p className="text-[11px] text-muted-foreground">{obj.key_results.length} Key Result{obj.key_results.length !== 1 ? "s" : ""}</p>
            <p className="text-[11px] text-muted-foreground">Progresso calculado a partir dos Key Results</p>
            {obj.health_reason && <p className="text-[11px] text-muted-foreground">Saúde: {obj.health_reason}</p>}
            {obj.manual_health_override && <p className="text-[11px] font-medium text-amber-700">Saúde ajustada manualmente: {obj.health_override_reason}</p>}
            {(obj.start_date || obj.end_date) && <p className="text-[11px] text-muted-foreground">Período: {obj.start_date ? new Date(`${obj.start_date}T00:00:00`).toLocaleDateString("pt-BR") : "—"} a {obj.end_date ? new Date(`${obj.end_date}T00:00:00`).toLocaleDateString("pt-BR") : "—"}</p>}
            {obj.measurement_status === "needs_configuration" && (
              <p className="text-[11px] text-amber-600">Objetivo legado: configure baseline e meta dos KRs para ativar a medição.</p>
            )}
          </div>
        </div>

        <div className="border-t">
          <button className="w-full flex items-center justify-between px-5 py-2.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors" onClick={() => setExpanded((v) => !v)}>
            <span className="font-medium">{expanded ? "Ocultar" : "Ver"} Key Results</span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
          </button>

          {expanded && (
            <div className="px-5 pb-5">
              {obj.key_results.length === 0 && !showKrForm && (
                <p className="text-xs text-muted-foreground text-center py-4 italic">Nenhum Key Result ainda. Adicione um abaixo para começar a medir o progresso.</p>
              )}

              {obj.key_results.map((kr) => (
                <OkrKeyResultRow key={kr.id} kr={kr} onCheckIn={(kr) => setCheckInKr(kr)} onRefresh={onRefreshKeyResult} onHistory={setHistoryKr} onUpdate={onUpdateKeyResult} onDelete={onDeleteKeyResult} />
              ))}

              {showKrForm && (
                <div className="mt-3 rounded-lg border bg-muted/30 p-4 space-y-3">
                  <p className="text-xs font-semibold">Novo Key Result</p>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">O que será medido?</label>
                    <input value={krTitle} onChange={(e) => setKrTitle(e.target.value)} placeholder="Ex: Reduzir retorno de HUs ao backlog para menos de 5 por sprint" className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><label className="text-[11px] font-medium text-muted-foreground">Tipo de atualização</label><select value={krUpdateType} onChange={(e) => setKrUpdateType(e.target.value as OkrKeyResult["update_type"])} className="h-9 w-full rounded-lg border bg-background px-3 text-sm"><option value="manual">Manual</option><option value="automatic">Automático</option><option value="hybrid">Híbrido</option></select></div>
                    <div className="space-y-1"><label className="text-[11px] font-medium text-muted-foreground">Direção</label><select value={krDirection} onChange={(e) => setKrDirection(e.target.value as OkrKeyResult["direction"])} className="h-9 w-full rounded-lg border bg-background px-3 text-sm"><option value="increase">Aumentar</option><option value="decrease">Diminuir</option><option value="range">Faixa</option></select></div>
                    {krUpdateType !== "manual" && <div className="space-y-1 col-span-2"><label className="text-[11px] font-medium text-muted-foreground">Métrica Axionn</label><select value={krMetricCode} onChange={(e) => setKrMetricCode(e.target.value)} className="h-9 w-full rounded-lg border bg-background px-3 text-sm"><option value="">Selecione</option>{OKR_METRIC_CATALOG.map((metric) => <option key={metric.code} value={metric.code}>{metric.name}</option>)}</select></div>}
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Tipo de métrica</label>
                      <select value={krUnit} onChange={(e) => { setKrUnit(e.target.value as OkrKeyResult["unit"]); setKrTarget(""); }} className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary">
                        {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                      {selectedUnit && <p className="text-[10px] text-muted-foreground">{selectedUnit.hint}</p>}
                    </div>
                    {krUnit !== "bool" && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">Meta (valor alvo)</label>
                        <input type="number" min={0} value={krTarget} onChange={(e) => setKrTarget(e.target.value)} placeholder={krUnit === "%" ? "Ex: 80" : "Ex: 5"} className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    <div className="space-y-1"><label className="text-[11px] font-medium text-muted-foreground">Valor inicial</label><input type="number" value={krBaseline} onChange={(e) => setKrBaseline(e.target.value)} className="h-9 w-full rounded-lg border bg-background px-3 text-sm" /></div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleCancelKr} disabled={isSavingKr}><X className="h-3 w-3" /> Cancelar</Button>
                    <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleAddKr} disabled={isSavingKr || !krTitle.trim() || (krUnit !== "bool" && !krTarget)}>
                      {isSavingKr ? <span className="flex items-center gap-1"><span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />Salvando...</span> : <><Plus className="h-3 w-3" /> Salvar Key Result</>}
                    </Button>
                  </div>
                </div>
              )}

              {onAddKeyResult && !showKrForm && (
                <Button variant="outline" size="sm" className="mt-3 w-full h-8 gap-1.5 text-xs border-dashed" onClick={() => setShowKrForm(true)}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar Key Result
                </Button>
              )}
              <OkrInitiativesPanel objectiveId={obj.id} />
            </div>
          )}
        </div>
      </div>

      <OkrCheckInModal kr={checkInKr} onClose={() => setCheckInKr(null)} onSubmit={(krId, input) => { onCheckIn(krId, input); setCheckInKr(null); }} />
      <OkrHistoryDialog kr={historyKr} onClose={() => setHistoryKr(null)} />
    </>
  );
}
