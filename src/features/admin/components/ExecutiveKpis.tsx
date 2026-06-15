import { UsersRound, Zap, LayoutList, AlertTriangle, CheckCircle2 } from "lucide-react";
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
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent: "green" | "blue" | "orange" | "red";
}

const ACCENT_CLASSES: Record<KpiCardProps["accent"], { icon: string; value: string; bg: string }> = {
  green:  { icon: "text-emerald-500",  value: "text-emerald-600 dark:text-emerald-400",  bg: "bg-emerald-50 dark:bg-emerald-950/40" },
  blue:   { icon: "text-blue-500",    value: "text-blue-600 dark:text-blue-400",        bg: "bg-blue-50 dark:bg-blue-950/40" },
  orange: { icon: "text-orange-500",  value: "text-orange-600 dark:text-orange-400",    bg: "bg-orange-50 dark:bg-orange-950/40" },
  red:    { icon: "text-red-500",     value: "text-red-600 dark:text-red-400",          bg: "bg-red-50 dark:bg-red-950/40" },
};

function KpiCard({ icon, label, value, sub, accent }: KpiCardProps) {
  const c = ACCENT_CLASSES[accent];
  return (
    <div className="flex-1 min-w-[140px] rounded-xl border bg-card p-4 shadow-sm flex flex-col gap-2">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.bg}`}>
        <span className={`h-4 w-4 ${c.icon}`}>{icon}</span>
      </div>
      <div>
        <p className={`text-2xl font-bold leading-none tabular-nums ${c.value}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <p className="text-xs text-muted-foreground leading-snug">{label}</p>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="flex-1 min-w-[140px] rounded-xl border bg-card p-4 shadow-sm flex flex-col gap-2">
      <Skeleton className="h-8 w-8 rounded-lg" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
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
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <KpiCard
        icon={<UsersRound className="h-4 w-4" />}
        label="Times Ativos"
        value={timesAtivos}
        accent="green"
      />
      <KpiCard
        icon={<Zap className="h-4 w-4" />}
        label="Sprint Ativa"
        value={sprintAtiva ?? "—"}
        accent="blue"
      />
      <KpiCard
        icon={<LayoutList className="h-4 w-4" />}
        label="HUs Ativas"
        value={husAtivas}
        sub={`${husConcluidasPct}% do total concluído`}
        accent="blue"
      />
      <KpiCard
        icon={<CheckCircle2 className="h-4 w-4" />}
        label="Demandas Abertas"
        value={demandasAbertas}
        accent="orange"
      />
      <KpiCard
        icon={<AlertTriangle className="h-4 w-4" />}
        label="SLA em Risco"
        value={slaEmRisco}
        sub={slaDescricao}
        accent="red"
      />
    </div>
  );
}
