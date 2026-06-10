import { useState } from "react";
import { MessageSquare, Pencil, Trash2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OkrKeyResult } from "../types";

const UNIT_OPTIONS: { value: OkrKeyResult["unit"]; label: string; display: string }[] = [
  { value: "%",     label: "Porcentagem (%)",  display: "%" },
  { value: "un",    label: "Número (contagem)", display: "" },
  { value: "pts",   label: "Pontuação (pts)",   display: "pts" },
  { value: "score", label: "Score",             display: "pts" },
  { value: "dias",  label: "Dias",              display: "dias" },
  { value: "R$",    label: "Valor (R$)",         display: "R$" },
  { value: "bool",  label: "Sim / Não",          display: "" },
  { value: "bugs",  label: "Bugs",              display: "bug(s)" },
];

function unitDisplay(unit: OkrKeyResult["unit"]): string {
  return UNIT_OPTIONS.find((u) => u.value === unit)?.display ?? unit;
}

interface Props {
  kr: OkrKeyResult;
  onCheckIn: (kr: OkrKeyResult) => void;
  onUpdate?: (id: string, payload: { title?: string; unit?: OkrKeyResult["unit"]; target?: number }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function krProgress(kr: OkrKeyResult): number {
  if (kr.unit === "bugs")  return kr.current === 0 ? 100 : Math.max(0, 100 - kr.current * 20);
  if (kr.unit === "bool")  return kr.current >= kr.target ? 100 : 0;
  if (kr.target === 0)     return 100;
  return Math.min(100, Math.round((kr.current / kr.target) * 100));
}

export function krProgressColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-400";
  return "bg-red-500";
}

export function krProgressTextColor(pct: number): string {
  if (pct >= 80) return "#22c55e";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

function fmtValue(kr: OkrKeyResult): string {
  if (kr.unit === "bool") return kr.current >= kr.target ? "✓ Concluído" : "✗ Pendente";
  if (kr.unit === "bugs") return `${kr.current} bug(s) / meta: ${kr.target}`;
  const d = unitDisplay(kr.unit);
  if (d === "%") return `${kr.current}% de ${kr.target}%`;
  if (d === "")  return `${kr.current} de ${kr.target}`;
  return `${kr.current} ${d} de ${kr.target} ${d}`;
}

export function OkrKeyResultRow({ kr, onCheckIn, onUpdate, onDelete }: Props) {
  const pct = krProgress(kr);

  const [editing, setEditing]       = useState(false);
  const [editTitle, setEditTitle]   = useState(kr.title);
  const [editUnit, setEditUnit]     = useState<OkrKeyResult["unit"]>(kr.unit);
  const [editTarget, setEditTarget] = useState(String(kr.target));
  const [isSaving, setIsSaving]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    if (!onUpdate || !editTitle.trim()) return;
    setIsSaving(true);
    try {
      await onUpdate(kr.id, { title: editTitle.trim(), unit: editUnit, target: editUnit === "bool" ? 1 : Number(editTarget) });
      setEditing(false);
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try { await onDelete(kr.id); }
    finally { setIsDeleting(false); setConfirmDel(false); }
  };

  if (editing) {
    return (
      <div className="py-3 border-b last:border-0 space-y-2">
        <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" placeholder="Título do Key Result" />
        <div className="grid grid-cols-2 gap-2">
          <select value={editUnit} onChange={(e) => { setEditUnit(e.target.value as OkrKeyResult["unit"]); setEditTarget(""); }} className="h-8 rounded-lg border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary">
            {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
          {editUnit !== "bool" && (
            <input type="number" min={0} value={editTarget} onChange={(e) => setEditTarget(e.target.value)} placeholder="Meta" className="h-8 rounded-lg border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary" />
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setEditing(false)} disabled={isSaving}><X className="h-3 w-3" /> Cancelar</Button>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave} disabled={isSaving || !editTitle.trim() || (editUnit !== "bool" && !editTarget)}>
            {isSaving ? <span className="flex items-center gap-1"><span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />Salvando...</span> : <><Check className="h-3 w-3" /> Salvar</>}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 py-3 border-b last:border-0">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm text-muted-foreground flex-1 leading-snug">{kr.title}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted-foreground">{fmtValue(kr)}</span>
          <span className="text-xs font-bold w-10 text-right" style={{ color: krProgressTextColor(pct) }}>{pct}%</span>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-primary" onClick={() => onCheckIn(kr)} title="Registrar check-in">
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
          {onUpdate && !confirmDel && (
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-primary" onClick={() => { setEditing(true); setEditTitle(kr.title); setEditUnit(kr.unit); setEditTarget(String(kr.target)); }} title="Editar Key Result">
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {onDelete && !confirmDel && (
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDel(true)} title="Excluir Key Result">
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
          {confirmDel && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-destructive font-medium">Excluir?</span>
              <Button variant="destructive" size="sm" className="h-6 text-[10px] px-2" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? "..." : "Sim"}
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setConfirmDel(false)} disabled={isDeleting}>Não</Button>
            </div>
          )}
        </div>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={cn("h-1.5 rounded-full transition-all duration-500", krProgressColor(pct))} style={{ width: `${pct}%` }} />
      </div>
      {kr.check_ins && kr.check_ins.length > 0 && (
        <p className="text-[11px] text-muted-foreground italic">Último check-in: &ldquo;{kr.check_ins[kr.check_ins.length - 1].note}&rdquo;</p>
      )}
    </div>
  );
}
