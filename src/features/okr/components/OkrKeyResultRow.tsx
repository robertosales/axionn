// ─── OkrKeyResultRow ─────────────────────────────────────────────────────────
// Linha de um Key Result dentro do card de objetivo

import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OkrKeyResult } from "../types";

interface Props {
  kr:           OkrKeyResult;
  onCheckIn:    (kr: OkrKeyResult) => void;
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
  if (kr.unit === "bool")  return kr.current >= kr.target ? "✓ Concluído" : "✗ Pendente";
  if (kr.unit === "bugs")  return `${kr.current} bug(s) / meta: ${kr.target}`;
  if (kr.unit === "score") return `${kr.current} / ${kr.target}`;
  return `${kr.current} ${kr.unit} de ${kr.target} ${kr.unit}`;
}

export function OkrKeyResultRow({ kr, onCheckIn }: Props) {
  const pct = krProgress(kr);

  return (
    <div className="flex flex-col gap-1.5 py-3 border-b last:border-0">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm text-muted-foreground flex-1 leading-snug">
          {kr.title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">{fmtValue(kr)}</span>
          <span
            className="text-xs font-bold w-10 text-right"
            style={{ color: krProgressTextColor(pct) }}
          >
            {pct}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
            onClick={() => onCheckIn(kr)}
            title="Registrar check-in"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className={cn("h-1.5 rounded-full transition-all duration-500", krProgressColor(pct))}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Histórico de check-ins (último) */}
      {kr.check_ins && kr.check_ins.length > 0 && (
        <p className="text-[11px] text-muted-foreground italic">
          Último check-in: &ldquo;{kr.check_ins[kr.check_ins.length - 1].note}&rdquo;
        </p>
      )}
    </div>
  );
}
