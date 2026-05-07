import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiItem {
  label: string;
  value: string | number;
}

interface PerformanceHeaderProps {
  title: string;
  subtitle?: string;
  sprintName?: string;
  sprintRange?: string;
  kpis?: KpiItem[];
  actions?: ReactNode;
  className?: string;
}

export function PerformanceHeader({
  title,
  subtitle,
  sprintName,
  sprintRange,
  kpis = [],
  actions,
  className,
}: PerformanceHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3",
        "rounded-xl border border-border/60 bg-gradient-to-r from-background to-muted/30 px-5 py-4",
        className,
      )}
    >
      {/* Left: title + sprint */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
          {sprintName && (
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs font-medium">
              {sprintName}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
          {sprintRange && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {sprintRange}
            </span>
          )}
          {kpis.map((kpi, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="h-3 w-px bg-border" />}
              <span className="text-xs">
                <span className="font-semibold tabular-nums text-foreground">{kpi.value}</span>
                {" "}
                <span className="text-muted-foreground">{kpi.label}</span>
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Right: actions */}
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
