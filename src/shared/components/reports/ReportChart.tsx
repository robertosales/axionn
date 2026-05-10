import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ReportChartProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  /** altura do container do gráfico (default: h-64) */
  height?: string;
  action?: ReactNode;
}

/**
 * Container padrão para qualquer gráfico Recharts.
 * Garante título, subtítulo e altura consistentes.
 */
export function ReportChart({ title, subtitle, children, className, height = "h-64", action }: ReportChartProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={cn("w-full", height)}>{children}</div>
      </CardContent>
    </Card>
  );
}
