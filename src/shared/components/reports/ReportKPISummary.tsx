import { ElementType, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface KPIItem {
  label: string;
  value: string | number;
  meta?: string;
  status?: "good" | "warning" | "danger" | "neutral" | "success";
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
  sub?: string;
  icon?: ReactNode | ElementType;
  trend?: { value: number; label?: string };
}

const STATUS_STYLES: Record<string, string> = {
  good:    "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/20",
  success: "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/20",
  warning: "border-l-amber-500  bg-amber-50   dark:bg-amber-950/20",
  danger:  "border-l-red-500    bg-red-50     dark:bg-red-950/20",
  neutral: "border-l-slate-300  bg-slate-50   dark:bg-slate-900/20",
};

const VALUE_STYLES: Record<string, string> = {
  good:    "text-emerald-700 dark:text-emerald-400",
  success: "text-emerald-700 dark:text-emerald-400",
  warning: "text-amber-700  dark:text-amber-400",
  danger:  "text-red-700    dark:text-red-400",
  neutral: "text-foreground",
};

function resolveIcon(icon?: ReactNode | ElementType): ReactNode {
  if (!icon) return null;
  if (typeof icon === "function") {
    const IconComp = icon as ElementType;
    return <IconComp className="h-5 w-5" />;
  }
  return icon as ReactNode;
}

interface ReportKPISummaryProps {
  items: KPIItem[];
  columns?: 2 | 3 | 4;
}

export function ReportKPISummary({ items, columns = 4 }: ReportKPISummaryProps) {
  const gridClass = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  }[columns];

  return (
    <div className={cn("grid gap-3", gridClass)}>
      {items.map((item, i) => {
        const st = item.status ?? "neutral";
        const iconNode = resolveIcon(item.icon);
        return (
          <div
            key={i}
            className={cn(
              "rounded-xl border border-border border-l-4 p-4 flex flex-col gap-1",
              STATUS_STYLES[st] ?? STATUS_STYLES.neutral
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                {item.label}
              </span>
              {iconNode && <span className="text-muted-foreground shrink-0">{iconNode}</span>}
            </div>
            <p className={cn("text-2xl font-bold", VALUE_STYLES[st] ?? VALUE_STYLES.neutral)}>
              {item.value}
            </p>
            {item.meta && <p className="text-[11px] text-muted-foreground">{item.meta}</p>}
            {item.sub  && <p className="text-xs text-muted-foreground">{item.sub}</p>}
            {item.badge && (
              <Badge variant={item.badgeVariant ?? "secondary"} className="text-[10px] w-fit mt-1">
                {item.badge}
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}
