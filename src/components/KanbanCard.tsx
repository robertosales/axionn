import { memo, useMemo, useCallback } from "react";
import { useSprint } from "@/contexts/SprintContext";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  Bug, Clock, AlertTriangle, Tag, Zap, CheckCircle2,
  Timer, TrendingUp,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { HU, Activity } from "@/types/sprint";

// ─── Constantes ────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, {
  label: string;
  barColor: string;
  badgeClass: string;
  ring: string;
}> = {
  critica: {
    label: "Crítica",
    barColor: "bg-red-600",
    badgeClass: "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30",
    ring: "ring-red-500/40",
  },
  alta: {
    label: "Alta",
    barColor: "bg-orange-500",
    badgeClass: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30",
    ring: "ring-orange-500/40",
  },
  media: {
    label: "Média",
    barColor: "bg-amber-400",
    badgeClass: "bg-amber-400/15 text-amber-600 dark:text-amber-400 border border-amber-400/30",
    ring: "ring-amber-400/30",
  },
  baixa: {
    label: "Baixa",
    barColor: "bg-sky-400",
    badgeClass: "bg-sky-400/15 text-sky-600 dark:text-sky-400 border border-sky-400/30",
    ring: "ring-sky-400/30",
  },
};

const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  task:          "bg-indigo-500",
  bug:           "bg-red-500",
  architecture:  "bg-purple-500",
  test:          "bg-amber-500",
  meeting:       "bg-cyan-500",
  documentation: "bg-emerald-500",
  review:        "bg-orange-500",
  other:         "bg-slate-400",
  // legado
  development:   "bg-blue-500",
  code_review:   "bg-purple-500",
};

// Paleta de cores para tags — cicla pelas cores baseado no texto da tag
const TAG_PALETTE = [
  "bg-blue-500/15   text-blue-700   dark:text-blue-400   border-blue-500/30",
  "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30",
  "bg-teal-500/15   text-teal-700   dark:text-teal-400   border-teal-500/30",
  "bg-rose-500/15   text-rose-700   dark:text-rose-400   border-rose-500/30",
  "bg-amber-500/15  text-amber-700  dark:text-amber-400  border-amber-500/30",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  "bg-cyan-500/15   text-cyan-700   dark:text-cyan-400   border-cyan-500/30",
  "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
];

function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) & 0xffff;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

/** Converte minutos → "Xd Yh" igual ao card da Sustentação */
function fmtMinutes(min: number): string {
  if (min <= 0) return "0h";
  const d = Math.floor(min / 480); // 8h/dia
  const h = Math.floor((min % 480) / 60);
  const m = min % 60;
  if (d > 0 && h > 0) return `${d}d ${h}h`;
  if (d > 0) return `${d}d`;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface KanbanCardProps {
  hu: HU;
  columnKey: string;
  draggingDisabled?: boolean;
  onSelect: (hu: HU) => void;
}

// ─── TagBadges ─────────────────────────────────────────────────────────────────
// Exibe as tags da HU como badges coloridos (ex: JUST, GESP, PDOP)

const TagBadges = memo(function TagBadges({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 4).map((tag) => (
        <span
          key={tag}
          className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
            tagColor(tag),
          )}
        >
          {tag}
        </span>
      ))}
      {tags.length > 4 && (
        <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] text-muted-foreground border border-border">
          +{tags.length - 4}
        </span>
      )}
    </div>
  );
});

// ─── PriorityBadge ─────────────────────────────────────────────────────────────

const PriorityBadge = memo(function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.baixa;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide",
      cfg.badgeClass,
    )}>
      <Zap className="w-2 h-2" />
      {cfg.label}
    </span>
  );
});

// ─── SizeBadge ─────────────────────────────────────────────────────────────────
// Exibe PP/P/M/G/GG + story points

const CardSizeBadge = memo(function CardSizeBadge({
  sizeReference,
  storyPoints,
}: { sizeReference?: string | null; storyPoints?: number | null }) {
  if (!sizeReference && (!storyPoints || storyPoints === 0)) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20">
          <TrendingUp className="w-2 h-2" />
          {sizeReference ?? ""}{sizeReference && storyPoints ? " · " : ""}{storyPoints ? `${storyPoints}pt` : ""}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>Tamanho: {sizeReference ?? "—"} · Story Points: {storyPoints ?? "—"}</p>
      </TooltipContent>
    </Tooltip>
  );
});

// ─── EpicBadge ─────────────────────────────────────────────────────────────────
// Epic com cor customizada — igual ao card da Sustentação com categoria

const EpicBadge = memo(function EpicBadge({ epicId }: { epicId: string }) {
  const { epics } = useSprint();
  const epic = useMemo(() => epics.find((e) => e.id === epicId), [epics, epicId]);
  if (!epic) return null;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-medium max-w-full truncate py-0.5"
      style={{ color: epic.color ?? "#818cf8" }}
    >
      <Tag className="w-2.5 h-2.5 shrink-0" />
      <span className="truncate">{epic.name}</span>
    </span>
  );
});

// ─── ActivityProgressBar ───────────────────────────────────────────────────────
// Barra de progresso com indicadores por tipo de atividade

const ActivityProgressBar = memo(function ActivityProgressBar({
  activities,
}: { activities: Activity[] }) {
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
    <div className="space-y-1.5">
      {/* Indicadores de tipo + contador */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {byType.map(([type, count]) => (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-0.5">
                  <span
                    className={cn(
                      "inline-block w-1.5 h-1.5 rounded-full",
                      ACTIVITY_TYPE_COLORS[type] ?? "bg-slate-400",
                    )}
                  />
                  <span className="text-[9px] text-muted-foreground font-medium">{count}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p className="capitalize">{type}</p></TooltipContent>
            </Tooltip>
          ))}
        </div>
        {/* Contador fechadas/total estilo Sustentação */}
        <span className={cn(
          "text-[9px] font-semibold tabular-nums",
          pct === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
        )}>
          <CheckCircle2 className="w-2.5 h-2.5 inline mr-0.5" />
          {closed}/{total}
        </span>
      </div>
      {/* Barra de progresso */}
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            pct === 100
              ? "bg-emerald-500"
              : pct >= 70
              ? "bg-primary"
              : pct >= 30
              ? "bg-amber-500"
              : "bg-red-400",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
});

// ─── AssigneeAvatars ───────────────────────────────────────────────────────────

const AssigneeAvatars = memo(function AssigneeAvatars({
  assigneeIds,
}: { assigneeIds: string[] }) {
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
            <div className="w-5 h-5 rounded-full bg-primary/20 border-2 border-card flex items-center justify-center text-[9px] font-bold text-primary cursor-default">
              {dev.name.charAt(0).toUpperCase()}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p>{dev.name}</p></TooltipContent>
        </Tooltip>
      ))}
      {members.length > 3 && (
        <div className="w-5 h-5 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[9px] font-medium text-muted-foreground">
          +{members.length - 3}
        </div>
      )}
    </div>
  );
});

// ─── HoursChip ─────────────────────────────────────────────────────────────────
// Formato "Xd Yh" igual ao card da Sustentação

const HoursChip = memo(function HoursChip({
  activities,
}: { activities: Activity[] }) {
  const { doneMin, totalMin } = useMemo(() => ({
    totalMin: activities.reduce((s, a) => s + Math.round(Number(a.hours) * 60), 0),
    doneMin:  activities.filter((a) => a.isClosed).reduce((s, a) => s + Math.round(Number(a.hours) * 60), 0),
  }), [activities]);

  if (totalMin === 0) return null;

  const isOverBudget = doneMin > totalMin;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(
          "inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums",
          isOverBudget ? "text-red-500" : "text-muted-foreground",
        )}>
          <Timer className="w-2.5 h-2.5" />
          {fmtMinutes(doneMin)}<span className="opacity-50">/</span>{fmtMinutes(totalMin)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>Realizado: {fmtMinutes(doneMin)} / Planejado: {fmtMinutes(totalMin)}</p>
        {isOverBudget && <p className="text-red-400 text-xs mt-0.5">⚠ Horas acima do planejado</p>}
      </TooltipContent>
    </Tooltip>
  );
});

// ─── Comparador shallow para memo ─────────────────────────────────────────────

function huPropsAreEqual(prev: KanbanCardProps, next: KanbanCardProps) {
  const p = prev.hu;
  const n = next.hu;
  return (
    p.id             === n.id             &&
    p.title          === n.title          &&
    p.code           === n.code           &&
    p.priority       === n.priority       &&
    p.storyPoints    === n.storyPoints    &&
    p.sizeReference  === n.sizeReference  &&
    p.status         === n.status         &&
    p.epicId         === n.epicId         &&
    // tags: compara JSON simples — tags raramente mudam
    JSON.stringify(p.tags) === JSON.stringify(n.tags) &&
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

  const activities = useMemo(
    () => allActivities.filter((a) => a.huId === hu.id),
    [allActivities, hu.id],
  );

  const activeImpediment = useMemo(
    () => allImpediments.find((i) => i.huId === hu.id && !i.resolvedAt),
    [allImpediments, hu.id],
  );

  const assigneeIds = useMemo(
    () => [...new Set(activities.map((a) => a.assigneeId).filter(Boolean))],
    [activities],
  );

  const openBugs = useMemo(
    () => activities.filter((a) => a.activityType === "bug" && !a.isClosed).length,
    [activities],
  );

  // Calcula total de horas para exibir overdue na borda
  const totalMin = useMemo(
    () => activities.reduce((s, a) => s + Math.round(Number(a.hours) * 60), 0),
    [activities],
  );
  const doneMin = useMemo(
    () => activities.filter((a) => a.isClosed).reduce((s, a) => s + Math.round(Number(a.hours) * 60), 0),
    [activities],
  );
  const isOverBudget = totalMin > 0 && doneMin > totalMin;

  const priorityCfg = PRIORITY_CONFIG[hu.priority] ?? PRIORITY_CONFIG.baixa;

  // ─── DnD-Kit ────────────────────────────────────────────────────────────────
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({
      id: hu.id,
      disabled: draggingDisabled,
      data: { hu, columnKey },
    });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const handleClick = useCallback(() => onSelect(hu), [onSelect, hu]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        "group relative bg-card border rounded-lg cursor-pointer select-none overflow-hidden",
        "hover:shadow-md hover:border-primary/40 transition-all duration-150",
        isDragging && "opacity-40 ring-2 ring-primary shadow-xl scale-[1.02]",
        activeImpediment && !isOverBudget && `ring-1 ${priorityCfg.ring}`,
        isOverBudget && "ring-1 ring-red-500/40",
      )}
    >
      {/* ── Barra de prioridade lateral ── */}
      <span
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[3px] rounded-r-sm",
          priorityCfg.barColor,
        )}
      />

      <div className="pl-3 pr-2.5 pt-2.5 pb-2 space-y-2">

        {/* ── Linha 1: código + prioridade + size ── */}
        <div className="flex items-center justify-between gap-1 min-w-0">
          <div className="flex items-center gap-1 min-w-0 flex-wrap">
            {/* Código RHM / identificador — destaque igual Sustentação */}
            <span className="text-[10px] font-mono font-semibold text-primary/80 shrink-0 tracking-tight">
              {hu.code}
            </span>
            <PriorityBadge priority={hu.priority} />
            <CardSizeBadge sizeReference={hu.sizeReference} storyPoints={hu.storyPoints} />
          </div>

          {/* Alertas no canto direito */}
          <div className="flex items-center gap-1 shrink-0">
            {isOverBudget && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Clock className="w-3 h-3 text-red-500" />
                </TooltipTrigger>
                <TooltipContent side="top"><p className="text-xs">Horas acima do planejado</p></TooltipContent>
              </Tooltip>
            )}
            {activeImpediment && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="text-xs font-semibold">Impedimento ativo</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {activeImpediment.reason}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* ── Título ── */}
        <p className="text-xs font-medium leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
          {hu.title}
        </p>

        {/* ── Tags — igual aos badges [JUST][GESP][PDOP] da Sustentação ── */}
        {hu.tags && hu.tags.length > 0 && (
          <TagBadges tags={hu.tags} />
        )}

        {/* ── Epic / Categoria — linha colorida igual Sustentação ── */}
        {hu.epicId && <EpicBadge epicId={hu.epicId} />}

        {/* ── Barra de progresso de atividades ── */}
        <ActivityProgressBar activities={activities} />

        {/* ── Divider ── */}
        {(activities.length > 0 || assigneeIds.length > 0) && (
          <div className="border-t border-border/50" />
        )}

        {/* ── Footer: avatares | horas | bugs ── */}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          {/* Esquerda: avatares + horas */}
          <div className="flex items-center gap-1.5 min-w-0">
            <AssigneeAvatars assigneeIds={assigneeIds} />
            <HoursChip activities={activities} />
          </div>

          {/* Direita: bugs abertos + atividades totais */}
          <div className="flex items-center gap-1.5 shrink-0">
            {openBugs > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25">
                    <Bug className="w-2.5 h-2.5" />
                    {openBugs}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top"><p>{openBugs} bug{openBugs > 1 ? "s" : ""} aberto{openBugs > 1 ? "s" : ""}</p></TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}, huPropsAreEqual);
