import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  Rows3,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AdminKpis } from "../hooks/useAdminKpis";

interface Props {
  kpis: AdminKpis["global"];
  sprintAtivo?: string | null;
}

interface MetricProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  tone: "teal" | "good" | "warning" | "danger";
}

const TONES = {
  teal: "text-teal-600 bg-teal-500/10",
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

export function SalaAgilKpis({ kpis, sprintAtivo }: Props) {
  const progress =
    kpis.totalHUs > 0
      ? Math.round((kpis.husConcluidasAtivas / kpis.totalHUs) * 100)
      : 0;

  return (
    <div className="-m-4 border-l-2 border-l-teal-500 p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
          <Zap className="h-4 w-4" />
        </div>
        <h3 className="text-[15px] font-semibold tracking-tight">Sala Ágil</h3>
        {sprintAtivo ? (
          <Badge className="border-0 bg-teal-500 text-[10px] text-white hover:bg-teal-500">
            {sprintAtivo}
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">
            Nenhuma sprint ativa
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px]">
          {kpis.timesSalaAgil} time{kpis.timesSalaAgil !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="grid grid-cols-2 items-stretch gap-3 2xl:grid-cols-4">
        <Metric
          label="HUs ativas"
          value={kpis.totalHUs}
          sub={`${progress}% concluído`}
          icon={ListChecks}
          tone="teal"
        />
        <Metric
          label="Concluídas"
          value={kpis.husConcluidasAtivas}
          sub={`${kpis.velocityPontos} pts velocity`}
          icon={CheckCircle2}
          tone="good"
        />
        <Metric
          label="Impedimentos"
          value={kpis.impedimentosAbertos}
          sub="abertos agora"
          icon={AlertTriangle}
          tone={
            kpis.impedimentosAbertos > 3
              ? "danger"
              : kpis.impedimentosAbertos > 0
                ? "warning"
                : "good"
          }
        />
        <Metric
          label="Backlog"
          value={kpis.backlogTotal}
          sub="HUs sem sprint"
          icon={Rows3}
          tone={kpis.backlogTotal > 20 ? "warning" : "teal"}
        />
      </div>
    </div>
  );
}
