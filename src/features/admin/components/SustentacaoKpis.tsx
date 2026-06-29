import { Badge } from "@/components/ui/badge";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Shield,
  type LucideIcon,
} from "lucide-react";
import type { AdminKpis } from "../hooks/useAdminKpis";

interface Props {
  kpis: AdminKpis["global"];
}

interface MetricProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  tone: "blue" | "good" | "warning" | "danger";
}

const TONES = {
  blue: "text-blue-600 bg-blue-500/10",
  good: "text-emerald-600 bg-emerald-500/10",
  warning: "text-orange-600 bg-orange-500/10",
  danger: "text-destructive bg-destructive/10",
} as const;

function Metric({ label, value, sub, icon: Icon, tone }: MetricProps) {
  const [textClass, bgClass] = TONES[tone].split(" ");

  return (
    <div className="flex h-full min-w-0 flex-col rounded-xl border border-border/70 bg-background/70 p-3.5">
      <div className="flex min-w-0 items-start gap-2">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bgClass} ${textClass}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <p className="min-w-0 break-words text-[10px] font-semibold uppercase leading-4 tracking-[0.06em] text-muted-foreground">
          {label}
        </p>
      </div>

      <p className={`mt-3 text-2xl font-bold leading-none tabular-nums ${textClass}`}>
        {value}
      </p>

      {sub && (
        <p className="mt-1.5 min-h-[28px] break-words text-[10px] leading-4 text-muted-foreground">
          {sub}
        </p>
      )}
    </div>
  );
}

export function SustentacaoKpis({ kpis }: Props) {
  const resolutionRate =
    kpis.demandasAbertas + kpis.demandasConcluidas > 0
      ? Math.round(
          (kpis.demandasConcluidas /
            (kpis.demandasAbertas + kpis.demandasConcluidas)) *
            100,
        )
      : 0;

  return (
    <div className="-m-4 border-l-2 border-l-blue-500 p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
          <Shield className="h-4 w-4" />
        </div>
        <h3 className="text-[15px] font-semibold tracking-tight">Sustentação</h3>
        <Badge
          variant="outline"
          className="border-blue-500/20 bg-blue-500/10 text-[10px] text-blue-700"
        >
          {kpis.timesSustentacao} time{kpis.timesSustentacao !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="grid grid-cols-2 items-stretch gap-3 2xl:grid-cols-4">
        <Metric
          label="Abertas"
          value={kpis.demandasAbertas}
          sub={`${resolutionRate}% taxa de resolução`}
          icon={Clock3}
          tone={kpis.demandasAbertas > 30 ? "warning" : "blue"}
        />
        <Metric
          label="Concluídas"
          value={kpis.demandasConcluidas}
          sub="total acumulado"
          icon={CheckCircle2}
          tone="good"
        />
        <Metric
          label="SLA em risco"
          value={kpis.slaEmRisco}
          sub="+5 dias sem conclusão"
          icon={AlertTriangle}
          tone={
            kpis.slaEmRisco > 5
              ? "danger"
              : kpis.slaEmRisco > 0
                ? "warning"
                : "good"
          }
        />
        <Metric
          label="Bloqueadas"
          value={kpis.demandasBloqueadas}
          sub="aguardando ação"
          icon={AlertOctagon}
          tone={kpis.demandasBloqueadas > 0 ? "danger" : "good"}
        />
      </div>
    </div>
  );
}
