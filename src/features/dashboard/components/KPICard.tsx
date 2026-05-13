import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";

interface Props {
  title:       string;
  value:       string | number;
  subtitle?:   string;
  icon:        ReactNode;
  trend?:      { value: number; label: string }; // positivo = bom
  variant?:    "default" | "success" | "warning" | "danger";
}

const VARIANT_STYLES = {
  default: "border-border",
  success: "border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20",
  warning: "border-orange-300 bg-orange-50/40 dark:bg-orange-950/20",
  danger:  "border-red-300 bg-red-50/40 dark:bg-red-950/20",
};

export function KPICard({ title, value, subtitle, icon, trend, variant = "default" }: Props) {
  return (
    <div className={`rounded-xl border-2 ${VARIANT_STYLES[variant]} bg-card p-4 space-y-2`}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium">{title}</p>
        <span className="text-muted-foreground opacity-60">{icon}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-bold leading-none">{value}</p>
        {trend && (
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 ${
              trend.value > 0 ? "text-emerald-600 border-emerald-300" :
              trend.value < 0 ? "text-red-500 border-red-300" :
              "text-muted-foreground"
            }`}
          >
            {trend.value > 0 ? "↑" : trend.value < 0 ? "↓" : "↔"} {Math.abs(trend.value)}% {trend.label}
          </Badge>
        )}
      </div>
      {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
