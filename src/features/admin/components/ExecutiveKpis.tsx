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
  critical?: boolean;
}

function KpiCard({ icon, label, value, sub, critical }: KpiCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-4 shadow-sm border border-border/40">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
      <p
        className={[
          "text-2xl font-bold leading-none tabular-nums",
          critical ? "text-destructive" : "text-foreground",
        ].join(" ")}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-muted-foreground/70 leading-none">{sub}</p>
      )}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-4 shadow-sm border border-border/40">
      <Skeleton className="h-3.5 w-16" />
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
        icon={<UsersRound />}
        label="Times Ativos"
        value={timesAtivos}
      />
      <KpiCard
        icon={<Zap />}
        label="Sprints Ativas"
        value={sprintAtiva ?? "—"}
      />
      <KpiCard
        icon={<LayoutList />}
        label="HUs Ativas"
        value={husAtivas}
        sub={`${husConcluidasPct}% concluído`}
      />
      <KpiCard
        icon={<CheckCircle2 />}
        label="Demandas Abertas"
        value={demandasAbertas}
      />
      <KpiCard
        icon={<AlertTriangle />}
        label="SLA em Risco"
        value={slaEmRisco}
        sub={slaDescricao}
        critical={slaEmRisco > 0}
      />
    </div>
  );
}
