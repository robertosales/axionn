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

// Tokens exatos Opção A — borda superior fina por status
const ACCENT_COLOR: Record<NonNullable<Props["variant"]>, string> = {
  default: "#0bbcaf",  // --teal
  success: "#16a34a",  // --green
  warning: "#d97706",  // --amber
  danger:  "#dc2626",  // --red
};

export function KPICard({ title, value, subtitle, icon, trend, variant = "default" }: Props) {
  const accentColor = ACCENT_COLOR[variant];

  return (
    <div
      className="rounded-xl bg-card p-4 space-y-2"
      style={{
        borderTop:    `3px solid ${accentColor}`,
        border:       `1px solid hsl(var(--border))`,
        borderTopColor: accentColor,          // garante prioridade
        boxShadow:    "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium">{title}</p>
        <span style={{ color: accentColor, opacity: 0.75 }}>{icon}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-bold leading-none" style={{ color: "hsl(var(--foreground))" }}>
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
