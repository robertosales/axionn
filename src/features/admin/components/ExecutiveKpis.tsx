import {
  AlertTriangle,
  ClipboardList,
  LayoutGrid,
  UsersRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ExecutiveKpisProps {
  timesAtivos: number;
  sprintAtiva: string | null;
  husAtivas: number;
  husConcluidasPct: number;
  demandasAbertas: number;
  slaEmRisco: number;
  slaDescricao?: string;
  loading: boolean;
}

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "teal" | "orange" | "danger";
}

const TONES = {
  teal: {
    icon: "bg-teal-500/10 text-teal-600",
    value: "text-foreground",
  },
  orange: {
    icon: "bg-orange-500/10 text-orange-600",
    value: "text-foreground",
  },
  danger: {
    icon: "bg-destructive/10 text-destructive",
    value: "text-destructive",
  },
} as const;

function KpiCard({ icon: Icon, label, value, sub, tone = "teal" }: KpiCardProps) {
  const styles = TONES[tone];

  return (
    <div className="flex min-h-[112px] items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className={`mt-1 text-[26px] font-bold leading-none tracking-tight tabular-nums ${styles.value}`}>
          {value}
        </p>
        {sub && (
          <p className="mt-1.5 truncate text-[11px] leading-none text-muted-foreground">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="flex min-h-[112px] items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <Skeleton className="h-11 w-11 rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-14" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

function splitSprintLabel(value: string | null) {
  if (!value) return { value: "—", sub: "Nenhuma sprint ativa" };
  const match = value.match(/^(\d+)\s+(.+)$/);
  if (!match) return { value, sub: undefined };
  return { value: match[1], sub: match[2] };
}

export function ExecutiveKpis({
  timesAtivos,
  sprintAtiva,
  husAtivas,
  husConcluidasPct,
  demandasAbertas,
  slaEmRisco,
  slaDescricao,
  loading,
}: ExecutiveKpisProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <KpiSkeleton key={index} />
        ))}
      </div>
    );
  }

  const sprint = splitSprintLabel(sprintAtiva);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard icon={UsersRound} label="Times ativos" value={timesAtivos} />
      <KpiCard icon={Zap} label="Sprints ativas" value={sprint.value} sub={sprint.sub} />
      <KpiCard
        icon={LayoutGrid}
        label="HUs ativas"
        value={husAtivas}
        sub={`${husConcluidasPct}% concluído`}
      />
      <KpiCard
        icon={ClipboardList}
        label="Demandas abertas"
        value={demandasAbertas}
        tone="orange"
      />
      <KpiCard
        icon={AlertTriangle}
        label="SLA em risco"
        value={slaEmRisco}
        sub={slaDescricao}
        tone={slaEmRisco > 0 ? "danger" : "teal"}
      />
    </div>
  );
}
