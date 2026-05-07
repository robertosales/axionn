import { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { METRIC_ACCENT, MetricAccent } from "./tokens";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; label?: string };
  accent?: MetricAccent;
  sublabel?: string;
  loading?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  accent = "neutral",
  sublabel,
  loading = false,
  className,
}: MetricCardProps) {
  const colors = METRIC_ACCENT[accent];

  if (loading) {
    return (
      <div className={cn("rounded-xl border border-border/60 bg-card p-4", className)}>
        <Skeleton className="h-10 w-10 rounded-full mb-3" />
        <Skeleton className="h-7 w-16 mb-1" />
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }

  const TrendIcon =
    !trend ? null
    : trend.value > 0 ? TrendingUp
    : trend.value < 0 ? TrendingDown
    : Minus;

  const trendColor =
    !trend ? ""
    : trend.value > 0 ? "text-emerald-600"
    : trend.value < 0 ? "text-red-500"
    : "text-slate-400";

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card p-4 hover:shadow-md transition-shadow",
        className,
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn("flex items-center justify-center h-10 w-10 rounded-full", colors.bg)}>
          <Icon className={cn("h-5 w-5", colors.text)} />
        </div>
        {TrendIcon && trend && (
          <span className={cn("flex items-center gap-0.5 text-xs font-medium", trendColor)}>
            <TrendIcon className="h-3 w-3" />
            {trend.value > 0 ? "+" : ""}{trend.value}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sublabel && (
        <p className={cn("text-[11px] font-medium mt-1.5", colors.text)}>{sublabel}</p>
      )}
    </div>
  );
}
