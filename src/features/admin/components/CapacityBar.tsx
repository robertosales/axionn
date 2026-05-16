import type { CapacityStatus } from "../hooks/useCapacityPlanner";

interface Props {
  pct:    number;
  status: CapacityStatus;
  showLabel?: boolean;
}

const BAR_COLOR: Record<CapacityStatus, string> = {
  ok:         "bg-emerald-500",
  warning:    "bg-orange-400",
  overloaded: "bg-destructive",
  idle:       "bg-muted-foreground/30",
  unknown:    "bg-muted-foreground/50",
};

const STATUS_LABEL: Record<CapacityStatus, string> = {
  ok:         "OK",
  warning:    "Atenção",
  overloaded: "Sobrecarregado",
  idle:       "Ocioso",
  unknown:    "Sem estimativa",
};

const STATUS_TEXT: Record<CapacityStatus, string> = {
  ok:         "text-emerald-600",
  warning:    "text-orange-500",
  overloaded: "text-destructive",
  idle:       "text-muted-foreground",
  unknown:    "text-muted-foreground",
};

export function CapacityBar({ pct, status, showLabel = true }: Props) {
  const capped = Math.min(pct, 100);
  return (
    <div className="space-y-1">
      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${BAR_COLOR[status]}`}
          style={{ width: `${capped}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between text-[10px]">
          <span className={`font-semibold ${STATUS_TEXT[status]}`}>{STATUS_LABEL[status]}</span>
          <span className="text-muted-foreground">{pct}%{pct > 100 ? " ⚠" : ""}</span>
        </div>
      )}
    </div>
  );
}
