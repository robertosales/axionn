import { Badge } from "@/components/ui/badge";
import { Clock, Bug, Wrench, Zap, CheckCircle2, Circle, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTIVITY_TYPE_BORDER, ACTIVITY_TYPE_COLOR } from "./tokens";

interface TimelineActivity {
  id: string;
  title: string;
  activityType?: string;
  isClosed?: boolean;
  isBlocked?: boolean;
  startDate?: string;
  endDate?: string;
  hours: number;
  huCode?: string;
  huTitle?: string;
}

interface TimelineCardProps {
  activity: TimelineActivity;
  className?: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  bug:         Bug,
  feature:     Zap,
  improvement: Zap,
  chore:       Wrench,
  task:        Circle,
};

const TYPE_LABELS: Record<string, string> = {
  bug:         "Bug",
  feature:     "Feature",
  improvement: "Melhoria",
  chore:       "Chore",
  task:        "Tarefa",
};

function formatDate(d?: string) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function TimelineCard({ activity, className }: TimelineCardProps) {
  const type = activity.activityType ?? "task";
  const borderClass = ACTIVITY_TYPE_BORDER[type] ?? "border-l-slate-400";
  const typeColor = ACTIVITY_TYPE_COLOR[type] ?? "#94a3b8";
  const TypeIcon = TYPE_ICONS[type] ?? Circle;

  const statusLabel = activity.isBlocked
    ? "Bloqueada"
    : activity.isClosed
    ? "Concluída"
    : "Em progresso";

  const statusIcon = activity.isBlocked
    ? AlertTriangle
    : activity.isClosed
    ? CheckCircle2
    : XCircle;

  const StatusIcon = statusIcon;

  const statusColor = activity.isBlocked
    ? "text-amber-500"
    : activity.isClosed
    ? "text-emerald-600"
    : "text-blue-500";

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-card px-4 py-3",
        "border-l-4",
        borderClass,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{activity.title}</p>
          {activity.huCode && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {activity.huCode}
              {activity.huTitle && ` · ${activity.huTitle}`}
            </p>
          )}
        </div>
        <span className="flex items-center gap-1 shrink-0 bg-muted rounded-full px-2 py-0.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {activity.hours}h
        </span>
      </div>

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {/* type badge */}
        <span
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ background: typeColor + "18", color: typeColor }}
        >
          <TypeIcon className="h-2.5 w-2.5" />
          {TYPE_LABELS[type] ?? type}
        </span>

        {/* status badge */}
        <span className={cn("flex items-center gap-1 text-[10px] font-medium", statusColor)}>
          <StatusIcon className="h-3 w-3" />
          {statusLabel}
        </span>

        {/* date range */}
        {(activity.startDate || activity.endDate) && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {formatDate(activity.startDate)}
            {activity.endDate && ` → ${formatDate(activity.endDate)}`}
          </span>
        )}
      </div>
    </div>
  );
}
