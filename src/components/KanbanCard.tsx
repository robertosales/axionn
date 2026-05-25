import { memo, useMemo, useCallback } from "react";
import { useSprint } from "@/contexts/SprintContext";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  Bug, Clock, CheckCircle, AlertTriangle, Tag,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatMinutes } from "@/lib/duration";
import type { HU, Activity } from "@/types/sprint";

// ─── Constantes ────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { label: string; color: string; ring: string }> = {
  must:   { label: "Must",   color: "bg-red-500/10 text-red-600 dark:text-red-400",           ring: "ring-red-500/40"   },
  should: { label: "Should", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",     ring: "ring-amber-500/40" },
  could:  { label: "Could",  color: "bg-sky-500/10 text-sky-600 dark:text-sky-400",           ring: "ring-sky-500/40"   },
  wont:   { label: "Won't",  color: "bg-slate-400/10 text-slate-500",                         ring: "ring-slate-400/30" },
};

const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  development: "bg-blue-500",
  test:        "bg-amber-500",
  code_review: "bg-purple-500",
  bug:         "bg-red-500",
  other:       "bg-slate-400",
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface KanbanCardProps {
  hu: HU;
  columnKey: string;
  draggingDisabled?: boolean;
  onSelect: (hu: HU) => void;
}

// ─── PriorityBadge ─────────────────────────────────────────────────────────────

// ✅ memo: só re-renderiza se `priority` muda
const PriorityBadge = memo(function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.wont;
  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide",
      cfg.color,
    )}>
      {cfg.label}
    </span>
  );
});

// ─── ActivityBar ───────────────────────────────────────────────────────────────

// ✅ memo + useMemo interno: barra de progresso só recalcula quando activities muda
const ActivityBar = memo(function ActivityBar({ activities }: { activities: Activity[] }) {
  const total  = activities.length;
  const closed = activities.filter((a) => a.isClosed).length;
  const pct    = total > 0 ? Math.round((closed / total) * 100) : 0;

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of activities) map[a.activityType] = (map[a.activityType] || 0) + 1;
    return Object.entries(map);
  }, [activities]);

  if (total === 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex gap-1">
          {byType.map(([type, count]) => (
            <span key={type} className="flex items-center gap-0.5">
              <span className={cn("inline-block w-1.5 h-1.5 rounded-full", ACTIVITY_TYPE_COLORS[type] ?? "bg-slate-400")} />
              {count}
            </span>
          ))}
        </span>
        <span>{closed}/{total}</span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            pct === 100 ? "bg-green-500" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
});

// ─── AssigneeAvatars ───────────────────────────────────────────────────────────

// ✅ selector local: busca apenas os devs deste card — não depende de todo o contexto
const AssigneeAvatars = memo(function AssigneeAvatars({ assigneeIds }: { assigneeIds: string[] }) {
  const { developers } = useSprint();
  const members = useMemo(
    () => assigneeIds.map((id) => developers.find((d) => d.id === id)).filter(Boolean),
    [assigneeIds, developers],
  );
  if (members.length === 0) return null;
  return (
    <div className="flex -space-x-1.5">
      {members.slice(0, 3).map((dev: any) => (
        <Tooltip key={dev.id}>
          <TooltipTrigger asChild>
            <div className="w-5 h-5 rounded-full bg-primary/20 border border-background flex items-center justify-center text-[9px] font-semibold text-primary ring-1 ring-background cursor-default">
              {dev.name.charAt(0).toUpperCase()}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p>{dev.name}</p></TooltipContent>
        </Tooltip>
      ))}
      {members.length > 3 && (
        <div className="w-5 h-5 rounded-full bg-muted border border-background flex items-center justify-center text-[9px] font-medium text-muted-foreground">
          +{members.length - 3}
        </div>
      )}
    </div>
  );
});

// ─── CardHoursChip ─────────────────────────────────────────────────────────────

// ✅ isolado para não re-render quando só muda impedimento
const CardHoursChip = memo(function CardHoursChip({ activities }: { activities: Activity[] }) {
  const { totalMin, doneMin } = useMemo(() => ({
    totalMin: activities.reduce((s, a) => s + Math.round(Number(a.hours) * 60), 0),
    doneMin:  activities.filter((a) => a.isClosed).reduce((s, a) => s + Math.round(Number(a.hours) * 60), 0),
  }), [activities]);

  if (totalMin === 0) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <Clock className="w-2.5 h-2.5" />
          {formatMinutes(doneMin)}/{formatMinutes(totalMin)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom"><p>Horas concluídas / planejadas</p></TooltipContent>
    </Tooltip>
  );
});

// ─── EpicLabel ─────────────────────────────────────────────────────────────────

// ✅ selector local: o card não re-renderiza quando outros epics são alterados
const EpicLabel = memo(function EpicLabel({ epicId }: { epicId: string }) {
  const { epics } = useSprint();
  const epic = useMemo(() => epics.find((e) => e.id === epicId), [epics, epicId]);
  if (!epic) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-violet-500 dark:text-violet-400 max-w-full">
      <Tag className="w-2.5 h-2.5 shrink-0" />
      <span className="truncate">{epic.name}</span>
    </span>
  );
});

// ─── Comparador de igualdade shallow para memo ────────────────────────────────

// ✅ Previne re-render se só mudou a referência de `hu` mas os valores são iguais.
function huPropsAreEqual(prev: KanbanCardProps, next: KanbanCardProps) {
  return (
    prev.hu.id             === next.hu.id             &&
    prev.hu.title          === next.hu.title          &&
    prev.hu.code           === next.hu.code           &&
    prev.hu.priority       === next.hu.priority       &&
    prev.hu.storyPoints    === next.hu.storyPoints    &&
    prev.hu.status         === next.hu.status         &&
    prev.hu.epicId         === next.hu.epicId         &&
    prev.columnKey         === next.columnKey         &&
    prev.draggingDisabled  === next.draggingDisabled  &&
    prev.onSelect          === next.onSelect
  );
}

// ─── KanbanCard ───────────────────────────────────────────────────────────────

export const KanbanCard = memo(function KanbanCard({
  hu,
  columnKey,
  draggingDisabled = false,
  onSelect,
}: KanbanCardProps) {
  const { activities: allActivities, impediments: allImpediments } = useSprint();

  // ✅ selector — filtra apenas as atividades desta HU
  const activities = useMemo(
    () => allActivities.filter((a) => a.huId === hu.id),
    [allActivities, hu.id],
  );

  // ✅ selector — impedimento ativo desta HU
  const activeImpediment = useMemo(
    () => allImpediments.find((i) => i.huId === hu.id && !i.resolvedAt),
    [allImpediments, hu.id],
  );

  // ✅ selector — assignees sem recriar Set desnecessariamente
  const assigneeIds = useMemo(
    () => [...new Set(activities.map((a) => a.assigneeId).filter(Boolean))],
    [activities],
  );

  // ✅ selector — bugs abertos
  const openBugs = useMemo(
    () => activities.filter((a) => a.activityType === "bug" && !a.isClosed).length,
    [activities],
  );

  const priorityCfg = PRIORITY_CONFIG[hu.priority] ?? PRIORITY_CONFIG.wont;

  // ─── DnD-Kit ──────────────────────────────────────────────────────────────
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: hu.id,
    disabled: draggingDisabled,
    data: { hu, columnKey },
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  // ✅ useCallback — handler estável, evita re-render de filhos
  const handleClick = useCallback(() => onSelect(hu), [onSelect, hu]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        "group relative bg-card border rounded-lg p-3 cursor-pointer select-none",
        "hover:shadow-md hover:border-primary/30 transition-all duration-150",
        isDragging && "opacity-40 ring-2 ring-primary shadow-lg",
        activeImpediment && `ring-1 ${priorityCfg.ring}`,
      )}
    >
      {/* Barra de prioridade lateral */}
      <span
        className={cn(
          "absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full",
          hu.priority === "must"   && "bg-red-500",
          hu.priority === "should" && "bg-amber-500",
          hu.priority === "could"  && "bg-sky-500",
          (!hu.priority || hu.priority === "wont") && "bg-slate-300 dark:bg-slate-600",
        )}
      />

      <div className="pl-2 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[10px] font-mono text-muted-foreground shrink-0">{hu.code}</span>
            <PriorityBadge priority={hu.priority} />
            {hu.storyPoints != null && hu.storyPoints > 0 && (
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 rounded">
                {hu.storyPoints}pt
              </span>
            )}
          </div>
          {activeImpediment && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px]">
                <p className="text-xs font-medium">Impedimento ativo</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{activeImpediment.reason}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Título */}
        <p className="text-xs font-medium leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
          {hu.title}
        </p>

        {/* Epic */}
        {hu.epicId && <EpicLabel epicId={hu.epicId} />}

        {/* Barra de progresso */}
        <ActivityBar activities={activities} />

        {/* Footer */}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <div className="flex items-center gap-2">
            <AssigneeAvatars assigneeIds={assigneeIds} />
            <CardHoursChip activities={activities} />
          </div>
          <div className="flex items-center gap-1.5">
            {openBugs > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-500">
                <Bug className="w-2.5 h-2.5" />
                {openBugs}
              </span>
            )}
            {activities.length > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <CheckCircle className="w-2.5 h-2.5" />
                {activities.filter((a) => a.isClosed).length}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}, huPropsAreEqual);
