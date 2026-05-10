import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KPIItem {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  /** Semáforo: 'good' | 'warning' | 'danger' | 'neutral' */
  status?: "good" | "warning" | "danger" | "neutral";
  trend?: { direction: "up" | "down" | "same"; isGood: boolean };
}

interface ReportKPISummaryProps {
  items: KPIItem[];
  cols?: 2 | 3 | 4 | 5 | 6;
}

const STATUS_RING: Record<string, string> = {
  good: "ring-1 ring-emerald-500/40",
  warning: "ring-1 ring-amber-400/40",
  danger: "ring-1 ring-red-500/40",
  neutral: "",
};

const STATUS_VALUE: Record<string, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-500 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
  neutral: "",
};

const STATUS_ICON_BG: Record<string, string> = {
  good: "bg-emerald-500/10 text-emerald-600",
  warning: "bg-amber-400/10 text-amber-500",
  danger: "bg-red-500/10 text-red-600",
  neutral: "bg-primary/10 text-primary",
};

export function ReportKPISummary({ items, cols = 4 }: ReportKPISummaryProps) {
  const gridClass = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-5",
    6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
  }[cols];

  return (
    <div className={cn("grid gap-3", gridClass)}>
      {items.map((item, i) => {
        const st = item.status ?? "neutral";
        const TrendIcon =
          item.trend?.direction === "up"
            ? TrendingUp
            : item.trend?.direction === "down"
              ? TrendingDown
              : Minus;
        return (
          <Card key={i} className={cn("transition-shadow hover:shadow-md", STATUS_RING[st])}>
            <CardContent className="p-4 flex items-start gap-3">
              {item.icon && (
                <div className={cn("rounded-lg p-2 shrink-0", STATUS_ICON_BG[st])}>
                  <span className="flex h-5 w-5 items-center justify-center">{item.icon}</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate">
                  {item.label}
                </p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className={cn("text-2xl font-bold leading-none", STATUS_VALUE[st])}>
                    {item.value}
                  </span>
                  {item.trend && (
                    <TrendIcon
                      className={cn(
                        "h-3.5 w-3.5",
                        item.trend.isGood ? "text-emerald-500" : "text-red-500",
                      )}
                    />
                  )}
                </div>
                {item.sub && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.sub}</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
