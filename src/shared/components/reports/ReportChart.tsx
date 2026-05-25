import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ReportChartProps {
  title?: string;
  titulo?: string;
  subtitle?: string;
  badge?: ReactNode;
  legenda?: Array<{ cor: string; label: string }>;
  children: ReactNode;
  className?: string;
  /** altura do container do gráfico (default: h-64). Aceita classe tailwind ou número (px) */
  height?: string | number;
  action?: ReactNode;
}

/**
 * Container padrão para qualquer gráfico Recharts.
 * Garante título, subtítulo e altura consistentes.
 */
export function ReportChart({ title, titulo, subtitle, badge, legenda, children, className, height = "h-64", action }: ReportChartProps) {
  const finalTitle = title ?? titulo ?? "";
  const heightStyle = typeof height === "number" ? { height: `${height}px` } : undefined;
  const heightClass = typeof height === "string" ? height : "";
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">{finalTitle}</CardTitle>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {(action || badge) && <div className="shrink-0">{action ?? badge}</div>}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={cn("w-full", heightClass)} style={heightStyle}>{children}</div>
        {legenda && legenda.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
            {legenda.map((l, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: l.cor }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
