import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  LucideIcon,
} from "lucide-react";

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  accent?: "destructive" | "warning" | "success";
  trend?: { direction: "up" | "down" | "same"; isGood: boolean };
  size?: "sm" | "md";
}

const accentConfig = {
  destructive: {
    bg: "bg-destructive/8 dark:bg-destructive/12",
    border: "border-destructive/25",
    icon: "text-destructive",
    value: "text-destructive",
    dot: "bg-destructive",
  },
  warning: {
    bg: "bg-[#eab308]/8 dark:bg-[#eab308]/12",
    border: "border-[#eab308]/25",
    icon: "text-[#eab308]",
    value: "text-[#eab308]",
    dot: "bg-[#eab308]",
  },
  success: {
    bg: "bg-emerald-500/8 dark:bg-emerald-500/12",
    border: "border-emerald-500/25",
    icon: "text-emerald-500",
    value: "text-emerald-500",
    dot: "bg-emerald-500",
  },
};

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  trend,
  size = "md",
}: KpiCardProps) {
  const cfg = accent ? accentConfig[accent] : null;

  const TrendIcon =
    trend?.direction === "up"
      ? TrendingUp
      : trend?.direction === "down"
        ? TrendingDown
        : Minus;

  const trendColor =
    !trend ? "" : trend.isGood ? "text-emerald-500" : "text-destructive";

  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-card transition-shadow hover:shadow-md",
        "flex flex-col items-start gap-3 p-4",
        cfg ? [cfg.bg, cfg.border] : "border-border/60",
        size === "sm" && "p-3 gap-2",
      )}
    >
      {/* Ícone */}
      <div
        className={cn(
          "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
          cfg ? cfg.bg : "bg-primary/10",
        )}
      >
        <Icon
          className={cn(
            "h-4.5 w-4.5",
            cfg ? cfg.icon : "text-primary",
          )}
        />
      </div>

      {/* Valor + tendência */}
      <div className="w-full">
        <div className="flex items-end justify-between gap-1">
          <span
            className={cn(
              "font-bold leading-none",
              size === "md" ? "text-2xl" : "text-xl",
              cfg ? cfg.value : "text-foreground",
            )}
          >
            {value}
          </span>
          {trend && (
            <TrendIcon
              className={cn("h-4 w-4 mb-0.5 shrink-0", trendColor)}
            />
          )}
        </div>

        {sub && (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
            {sub}
          </p>
        )}
      </div>

      {/* Label */}
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-wider mt-auto",
          cfg ? cfg.icon : "text-muted-foreground",
        )}
      >
        {label}
      </p>

      {/* Dot de alerta */}
      {accent && accent !== "success" && (
        <span
          className={cn(
            "absolute top-3 right-3 h-2 w-2 rounded-full",
            cfg?.dot,
            accent === "destructive" && "animate-pulse",
          )}
        />
      )}
    </div>
  );
}

// Grupo de KPIs com separação visual em 2 linhas
interface KpiGroupProps {
  delivery: KpiCardProps[];
  operational: KpiCardProps[];
}

export function KpiGroup({ delivery, operational }: KpiGroupProps) {
  return (
    <div className="space-y-3">
      {/* Linha 1 — Entrega */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 pl-1">
          Entrega
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {delivery.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>
      </div>

      {/* Linha 2 — Operacional */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 pl-1">
          Operacional
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {operational.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>
      </div>
    </div>
  );
}
