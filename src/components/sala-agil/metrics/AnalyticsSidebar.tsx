import { cn } from "@/lib/utils";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_TOOLTIP_STYLE, STATUS_COLORS } from "./tokens";

interface MemberMetrics {
  id: string;
  name: string;
  role: string;
  tasksAssigned: number;
  tasksCompleted: number;
  hoursPlanned: number;
  hoursCompleted: number;
  efficiency: number;
  bugsAssigned: number;
  bugsResolved: number;
  wip: number;
  cycleTime: number;
  tasksByStatus: { name: string; value: number; color: string }[];
}

interface AnalyticsSidebarProps {
  member: MemberMetrics;
  onClose: () => void;
  className?: string;
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
      >
        {title}
        <Icon className="h-3.5 w-3.5" />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function KpiRow({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex items-start justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold tabular-nums" style={color ? { color } : {}}>{value}</span>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export function AnalyticsSidebar({ member, onClose, className }: AnalyticsSidebarProps) {
  const effColor = member.efficiency >= 80 ? "#22c55e" : member.efficiency >= 60 ? "#f59e0b" : "#ef4444";

  const pieData = member.tasksByStatus.filter((s) => s.value > 0);

  return (
    <aside
      className={cn(
        "w-72 shrink-0 border-l border-border/60 bg-muted/30 flex flex-col overflow-y-auto",
        className,
      )}
    >
      {/* Sidebar header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <span className="text-sm font-semibold text-foreground">Analytics</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <Section title="KPIs">
        <KpiRow label="Tarefas" value={`${member.tasksCompleted}/${member.tasksAssigned}`}
          sub={`${Math.round((member.tasksCompleted / Math.max(member.tasksAssigned, 1)) * 100)}% concluídas`}
          color="#22c55e"
        />
        <KpiRow label="Horas" value={`${member.hoursCompleted}h / ${member.hoursPlanned}h`}
          sub="planejado vs realizado"
        />
        <KpiRow label="Eficiência" value={`${member.efficiency}%`} color={effColor}
          sub={member.efficiency >= 80 ? "Dentro da meta" : "Abaixo da meta (80%)"}
        />
        <KpiRow label="WIP" value={`${member.wip}`} sub="atividades em progresso" />
        <KpiRow label="Cycle Time" value={`${member.cycleTime}d`} sub="média por atividade" />

        {/* Efficiency bar */}
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Eficiência</span>
            <span style={{ color: effColor }}>{member.efficiency}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(member.efficiency, 100)}%`, background: effColor }}
            />
          </div>
          <div className="flex justify-end text-[9px] text-muted-foreground mt-0.5">meta 80%</div>
        </div>
      </Section>

      <Section title="Distribuição de Tarefas">
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%" cy="50%"
                innerRadius={36} outerRadius={58}
                dataKey="value"
                paddingAngle={2}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color ?? STATUS_COLORS[entry.name] ?? "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip {...CHART_TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">Sem dados de tarefas</p>
        )}
        <div className="space-y-1.5 mt-1">
          {pieData.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                {s.name}
              </span>
              <span className="text-xs font-semibold tabular-nums">{s.value}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Bugs">
        <KpiRow label="Atribuídos" value={`${member.bugsAssigned}`} />
        <KpiRow
          label="Resolvidos"
          value={`${member.bugsResolved}`}
          color={member.bugsResolved === member.bugsAssigned && member.bugsAssigned > 0 ? "#22c55e" : undefined}
        />
        {member.bugsAssigned > 0 && (
          <div className="mt-2">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.round((member.bugsResolved / member.bugsAssigned) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 text-right">
              {Math.round((member.bugsResolved / member.bugsAssigned) * 100)}% resolvidos
            </p>
          </div>
        )}
      </Section>
    </aside>
  );
}
