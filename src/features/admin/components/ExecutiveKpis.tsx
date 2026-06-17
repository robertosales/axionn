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
    <div className="flex flex-col gap-1.5 rounded-xl bg-card p-4 shadow-sm border border-border/40">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.bg} mb-1`}>
        <span className={`h-4 w-4 ${c.icon}`}>{icon}</span>
      </div>
      <div>
        <p className={`text-2xl font-bold leading-none tabular-nums ${c.value}`}>{value}</p>
        <p className="text-[10px] text-muted-foreground font-medium mt-1">{label}</p>
        {sub && <p className="text-[9px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-4 shadow-sm border border-border/40">
      <Skeleton className="h-8 w-8 rounded-lg" />
      <Skeleton className="h-6 w-12 mt-1" />
      <Skeleton className="h-3 w-20" />
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <KpiCard
        icon={<UsersRound className="h-4 w-4" />}
        label="Times Ativos"
        value={timesAtivos}
        accent="green"
      />
      <KpiCard
        icon={<Zap className="h-4 w-4" />}
        label="Sprints Ativas"
        value={sprintAtiva ?? "—"}
        accent="blue"
      />
      <KpiCard
        icon={<LayoutList className="h-4 w-4" />}
        label="HUs Ativas"
        value={husAtivas}
        sub={`${husConcluidasPct}% concluído`}
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
