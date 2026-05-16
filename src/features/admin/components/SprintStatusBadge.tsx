// src/features/admin/components/SprintStatusBadge.tsx
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getSprintStatus } from "@/utils/sprintStatus";

interface SprintStatusBadgeProps {
  sprint: {
    isActive?: boolean;
    is_active?: boolean;
    endDate?: string | null;
    end_date?: string | null;
    closedAt?: string | null;
    closed_at?: string | null;
    delayDays?: number | null;
    delay_days?: number | null;
  };
  className?: string;
}

/**
 * Badge semântico de status de sprint.
 * Usa getSprintStatus() como única fonte de verdade.
 *
 * Estados possíveis:
 *  🟢 Ativa            — is_active=true, dentro do prazo
 *  🔴 Ativa (Xd atraso)— is_active=true, passou da data
 *  ⏳ Aguardando        — is_active=false, closed_at=null, end_date futura
 *  🏁 Encerrada        — is_active=false, closed_at preenchido
 *  ⚫ Encerrada        — is_active=false, closed_at=null, end_date passada (histórico)
 */
export function SprintStatusBadge({ sprint, className }: SprintStatusBadgeProps) {
  if (!sprint) return null;

  const { label, emoji, colorClass } = getSprintStatus(sprint);

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-semibold gap-1 px-2 py-0.5 whitespace-nowrap",
        colorClass,
        className,
      )}
    >
      <span>{emoji}</span>
      <span>{label}</span>
    </Badge>
  );
}
