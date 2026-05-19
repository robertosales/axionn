import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Circle, MinusCircle, Clock,
  Lock, ShieldCheck, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRdmChecklist } from "../hooks/useRdmChecklist";
import type { RdmChecklistStatus } from "../types/rdm";
import { RDM_CHECKLIST_STATUS_LABELS } from "../types/rdm";

// ── Metadados visuais por fase ───────────────────────────────────
const FASE_META = {
  pre_implantacao: {
    label:    "Pré-Implantação",
    step:     1,
    bar:      "bg-blue-500",
    badge:    "bg-blue-500/15 text-blue-400 border-blue-500/20",
    stepDone: "bg-blue-500 text-white",
    stepAct:  "bg-blue-500/20 text-blue-400 ring-2 ring-blue-500/40",
    stepLock: "bg-muted text-muted-foreground",
    ring:     "ring-1 ring-blue-500/40",
    blocker:  null, // sempre liberada
  },
  execucao: {
    label:    "Execução",
    step:     2,
    bar:      "bg-orange-500",
    badge:    "bg-orange-500/15 text-orange-400 border-orange-500/20",
    stepDone: "bg-orange-500 text-white",
    stepAct:  "bg-orange-500/20 text-orange-400 ring-2 ring-orange-500/40",
    stepLock: "bg-muted text-muted-foreground",
    ring:     "ring-1 ring-orange-500/40",
    blocker:  "Pré-Implantação",
  },
  pos_implantacao: {
    label:    "Pós-Implantação",
    step:     3,
    bar:      "bg-emerald-500",
    badge:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    stepDone: "bg-emerald-500 text-white",
    stepAct:  "bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/40",
    stepLock: "bg-muted text-muted-foreground",
    ring:     "ring-1 ring-emerald-500/40",
    blocker:  "Execução",
  },
} as const;

type FaseKey = keyof typeof FASE_META;
const FASE_ORDER: FaseKey[] = ["pre_implantacao", "execucao", "pos_implantacao"];

const STATUS_ICON: Record<RdmChecklistStatus, React.ReactNode> = {
  pendente:      <Circle       className="h-4 w-4 text-slate-400" />,
  em_andamento:  <Clock        className="h-4 w-4 text-yellow-400" />,
  concluido:     <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  nao_aplicavel: <MinusCircle  className="h-4 w-4 text-muted-foreground" />,
};

const NEXT_STATUS: Record<RdmChecklistStatus, RdmChecklistStatus> = {
  pendente:      "em_andamento",
  em_andamento:  "concluido",
  concluido:     "nao_aplicavel",
  nao_aplicavel: "pendente",
};

interface Props { rdmId: string }

export function RdmChecklistPanel({ rdmId }: Props) {
  const { grouped, progress, faseStatus, loading, update } = useRdmChecklist(rdmId);
  const [faseAberta, setFaseAberta] = useState<FaseKey>("pre_implantacao");

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
    </div>
  );

  const totalItems = Object.values(grouped).flat().length;

  return (
    <div className="space-y-5">

      {/* ===== Progresso global ===== */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Progresso Total</span>
          <span className="text-muted-foreground font-mono">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ===== Steps das 3 fases ===== */}
      <div className="grid grid-cols-3 gap-2">
        {faseStatus.map((fs, idx) => {
          const meta   = FASE_META[fs.key];
          const ativa  = fs.key === faseAberta;
          const locked = !fs.liberada;

          return (
            <button
              key={fs.key}
              onClick={() => !locked && setFaseAberta(fs.key)}
              disabled={locked}
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all text-center",
                locked
                  ? "border-border bg-muted/5 opacity-50 cursor-not-allowed"
                  : ativa
                    ? cn("border-border bg-muted/40", meta.ring)
                    : "border-border bg-muted/10 hover:bg-muted/30"
              )}
            >
              {/* Ícone do step */}
              <span className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                locked        ? meta.stepLock :
                fs.concluida  ? meta.stepDone :
                ativa         ? meta.stepAct  :
                                meta.stepLock
              )}>
                {locked
                  ? <Lock className="h-3.5 w-3.5" />
                  : fs.concluida
                    ? <CheckCircle2 className="h-4 w-4" />
                    : meta.step}
              </span>

              <p className="text-[11px] font-semibold leading-tight">{meta.label}</p>

              {/* Mini barra */}
              <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    locked ? "bg-muted-foreground/20" : meta.bar
                  )}
                  style={{ width: `${fs.pct}%` }}
                />
              </div>

              <p className="text-[10px] text-muted-foreground font-mono">
                {locked
                  ? <span className="flex items-center gap-0.5 justify-center">
                      <Lock className="h-2.5 w-2.5" /> Bloqueada
                    </span>
                  : <>{fs.done}/{fs.total} &middot; {fs.pct}%</>}
              </p>

              {/* Conector */}
              {idx < FASE_ORDER.length - 1 && (
                <span className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-muted-foreground text-xs">
                  ›
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ===== Itens da fase aberta ===== */}
      {faseStatus.map((fs) => {
        if (fs.key !== faseAberta) return null;
        const meta    = FASE_META[fs.key];
        const items   = grouped[fs.key] ?? [];
        const locked  = !fs.liberada;
        const nextKey = FASE_ORDER[FASE_ORDER.indexOf(fs.key) + 1] as FaseKey | undefined;
        const nextMeta = nextKey ? FASE_META[nextKey] : null;

        return (
          <div
            key={fs.key}
            className="rounded-xl border border-border bg-muted/10 overflow-hidden"
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                  locked ? meta.stepLock :
                  fs.concluida ? meta.stepDone : meta.stepAct
                )}>
                  {locked
                    ? <Lock className="h-3 w-3" />
                    : fs.concluida
                      ? <CheckCircle2 className="h-3.5 w-3.5" />
                      : meta.step}
                </span>
                <span className="text-sm font-semibold">{meta.label}</span>
                {fs.concluida && (
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                    meta.badge
                  )}>Concluída</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground font-mono">{fs.pct}%</span>
            </div>

            {/* Barra da fase */}
            <div className="h-1 w-full bg-muted">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  locked ? "bg-muted-foreground/20" : meta.bar
                )}
                style={{ width: `${fs.pct}%` }}
              />
            </div>

            {/* Banner de bloqueio */}
            {locked && (
              <div className="flex items-center gap-3 px-4 py-4 bg-muted/30">
                <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Fase bloqueada
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Conclua todos os itens da fase{" "}
                    <strong>{meta.blocker}</strong> para liberar esta fase.
                  </p>
                </div>
              </div>
            )}

            {/* Itens */}
            {!locked && (
              <div className="divide-y divide-border/50">
                {items.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-6">
                    Nenhum item nesta fase.
                  </p>
                )}
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() =>
                      update(item.id, {
                        status: NEXT_STATUS[item.status as RdmChecklistStatus],
                        concluido_em:
                          NEXT_STATUS[item.status as RdmChecklistStatus] === "concluido"
                            ? new Date().toISOString()
                            : null,
                      })
                    }
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors",
                      "hover:bg-muted/60"
                    )}
                  >
                    <span className="mt-0.5 shrink-0">
                      {STATUS_ICON[item.status as RdmChecklistStatus] ?? STATUS_ICON.pendente}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm leading-snug",
                        item.status === "concluido"     && "line-through text-muted-foreground",
                        item.status === "nao_aplicavel" && "text-muted-foreground/60"
                      )}>
                        {item.descricao}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {RDM_CHECKLIST_STATUS_LABELS[item.status as RdmChecklistStatus]}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Rodapé */}
            {!locked && items.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 bg-muted/20">
                <p className="text-[11px] text-muted-foreground">
                  {fs.done} de {fs.total} itens resolvidos
                </p>
                {fs.concluida && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    <ShieldCheck className="h-3.5 w-3.5" /> Fase concluída
                  </span>
                )}
              </div>
            )}

            {/* Botão "Avançar para próxima fase" quando 100% e há próxima */}
            {!locked && fs.concluida && nextKey && nextMeta && (
              <div className="px-4 pb-4">
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "w-full gap-2 mt-2",
                    nextMeta.badge,
                    "border"
                  )}
                  onClick={() => setFaseAberta(nextKey)}
                >
                  <ArrowRight className="h-4 w-4" />
                  Avançar para {nextMeta.label}
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {totalItems === 0 && (
        <p className="text-center text-sm text-muted-foreground py-6">
          Nenhum item de checklist cadastrado.
        </p>
      )}
    </div>
  );
}
