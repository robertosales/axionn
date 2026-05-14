/**
 * sprintStatus.ts
 * Helper centralizado para derivar o status semântico de uma sprint.
 *
 * Regras de negócio:
 * - Uma sprint SÓ é "encerrada" quando fechada manualmente via closeSprint().
 * - A data fim (end_date) é apenas planejamento; ultrapassá-la NÃO encerra a sprint.
 * - Se is_active=true  e hoje > end_date  → sprint ATIVA MAS ATRASADA.
 * - Se is_active=false e closed_at=null  e end_date FUTURA  → sprint AGUARDANDO INÍCIO.
 * - Se is_active=false e closed_at=null  e end_date PASSADA → encerrada sem registro (histórico).
 */

export type SprintStatusType =
  | "ativa"                  // is_active=true, dentro do prazo
  | "ativa_atrasada"         // is_active=true, end_date já passou
  | "aguardando"             // is_active=false, closed_at=null, end_date futura (sprint planejada)
  | "encerrada"              // is_active=false, closed_at preenchido
  | "encerrada_sem_registro"; // is_active=false, closed_at=null, end_date passada (histórico antigo)

export interface SprintStatusResult {
  status: SprintStatusType;
  /** Dias de atraso (> 0 apenas para ativa_atrasada ou encerrada com delay_days) */
  delayDays: number;
  /** Label legível para exibição */
  label: string;
  /** Emoji representativo */
  emoji: string;
  /** Classe de cor Tailwind para badges */
  colorClass: string;
}

/**
 * Retorna o status semântico de uma sprint.
 * Compatível com os campos do banco (snake_case ou camelCase).
 */
export function getSprintStatus(sprint: {
  is_active?: boolean;
  isActive?: boolean;
  end_date?: string | null;
  endDate?: string | null;
  closed_at?: string | null;
  closedAt?: string | null;
  delay_days?: number | null;
  delayDays?: number | null;
}): SprintStatusResult {
  const isActive  = sprint.is_active  ?? sprint.isActive  ?? false;
  const endDate   = sprint.end_date   ?? sprint.endDate   ?? null;
  const closedAt  = sprint.closed_at  ?? sprint.closedAt  ?? null;
  const delayDays = sprint.delay_days ?? sprint.delayDays ?? null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Sprint ATIVA ────────────────────────────────────────────────────────
  if (isActive) {
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - end.getTime()) / 86_400_000);
      if (diffDays > 0) {
        return {
          status: "ativa_atrasada",
          delayDays: diffDays,
          label: `Ativa (${diffDays}d atraso)`,
          emoji: "🔴",
          colorClass: "bg-red-500/15 border-red-500/40 text-red-600",
        };
      }
    }
    return {
      status: "ativa",
      delayDays: 0,
      label: "Ativa",
      emoji: "🟢",
      colorClass: "bg-amber-400/15 border-amber-400/40 text-amber-600",
    };
  }

  // ── Sprint ENCERRADA (com registro manual) ───────────────────────────────
  if (closedAt) {
    const days = delayDays ?? 0;
    return {
      status: "encerrada",
      delayDays: days,
      label: days > 0 ? `Encerrada (${days}d atraso)` : "Encerrada",
      emoji: "🏁",
      colorClass: "bg-slate-400/15 border-slate-400/40 text-slate-500",
    };
  }

  // ── Sprint AGUARDANDO INÍCIO (futura, ainda não ativada) ──────────────────
  // Condição: is_active=false + closed_at=null + end_date no futuro
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    if (end > today) {
      return {
        status: "aguardando",
        delayDays: 0,
        label: "Aguardando",
        emoji: "⏳",
        colorClass: "bg-blue-500/15 border-blue-400/40 text-blue-600",
      };
    }
  }

  // ── Sprint encerrada sem registro (histórico antigo / end_date passada) ───
  return {
    status: "encerrada_sem_registro",
    delayDays: 0,
    label: "Encerrada",
    emoji: "⚫",
    colorClass: "bg-slate-400/15 border-slate-400/40 text-slate-500",
  };
}

/**
 * Calcula quantos dias de atraso uma sprint teve ao ser encerrada.
 * Retorna 0 se encerrada antes ou no prazo.
 */
export function calcDelayDays(endDate: string | null, closedAt: string): number {
  if (!endDate) return 0;
  const end    = new Date(endDate);    end.setHours(0, 0, 0, 0);
  const closed = new Date(closedAt);  closed.setHours(0, 0, 0, 0);
  const diff   = Math.floor((closed.getTime() - end.getTime()) / 86_400_000);
  return Math.max(0, diff);
}
