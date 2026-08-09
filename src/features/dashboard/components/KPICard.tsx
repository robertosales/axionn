import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";

interface Props {
  title:     string;
  value:     string | number;
  subtitle?: string;
  icon:      ReactNode;
  trend?:    { value: number; label: string };
  variant?:  "default" | "success" | "warning" | "danger";
}

const TONE: Record<NonNullable<Props["variant"]>, string> = {
  default: "capacity",
  success: "success",
  warning: "warning",
  danger:  "danger",
};

export function KPICard({ title, value, subtitle, icon, trend, variant = "default" }: Props) {
  return (
    <div
      className="metric-panel p-4 pl-5 space-y-2"
      data-tone={TONE[variant]}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium">{title}</p>
        <span className="metric-icon h-9 w-9 rounded-xl">{icon}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="metric-value text-2xl font-bold leading-none">
          {value}
        </p>
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
      {subtitle && (
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
