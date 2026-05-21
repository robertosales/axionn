import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { UserStory } from "@/types/sprint";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Bug, Plus, ArrowRightLeft, AlertTriangle, Eye, Pencil, Copy, ListChecks, Clock,
} from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";
import { useSprint } from "@/contexts/SprintContext";
import { QuickActivityDialog } from "./QuickActivityDialog";
import { HUPreviewSheet } from "./HUPreviewSheet";
import { HUEditDrawer } from "./HUEditDrawer";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
  ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatPersonName, getInitials } from "@/lib/personName";
import { getTotalHoursForHU } from "@/types/sprint";
import { formatMinutes } from "@/lib/duration";

interface Props {
  hu: UserStory;
  colHex?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  low:      "bg-slate-100 text-slate-700 border-slate-300",
  medium:   "bg-blue-100 text-blue-700 border-blue-300",
  high:     "bg-amber-100 text-amber-700 border-amber-300",
  critical: "bg-red-100 text-red-700 border-red-300",
  baixa:    "bg-slate-100 text-slate-700 border-slate-300",
  media:    "bg-blue-100 text-blue-700 border-blue-300",
  alta:     "bg-amber-100 text-amber-700 border-amber-300",
  critica:  "bg-red-100 text-red-700 border-red-300",
};

const AVATAR_COLORS = [
  "#16a34a","#0891b2","#7c3aed","#db2777","#ea580c",
  "#0284c7","#9333ea","#dc2626","#ca8a04","#0d9488",
  "#2563eb","#c026d3",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function hoursColor(
  launched: number,
  estimated: number | null | undefined,
): { text: string; bg: string; border: string } {
  if (!estimated || estimated <= 0) {
    return { text: "text-muted-foreground", bg: "bg-muted/40", border: "border-border" };
  }
  const pct = launched / estimated;
  if (pct > 1.2)  return { text: "text-red-600 dark:text-red-400",    bg: "bg-red-50 dark:bg-red-950/30",    border: "border-red-300 dark:border-red-800" };
  if (pct > 1.0)  return { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-300 dark:border-amber-800" };
  if (pct === 1.0) return { text: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/30",   border: "border-blue-300 dark:border-blue-800" };
  return { text: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-950/30",  border: "border-green-300 dark:border-green-800" };
}

// ─── #3: Aging badge ────────────────────────────────────────────────────────────
function calcAgingDays(hu: UserStory): number {
  const ref = (hu as any).statusChangedAt || hu.createdAt;
  if (!ref) return 0;
  const refDate = new Date(ref);
  if (isNaN(refDate.getTime())) return 0;
  const diffMs = Date.now() - refDate.getTime();
  return Math.floor(diffMs / 86_400_000);
}

function AgingBadge({ days, colHex }: { days: number; colHex?: string }) {
  if (days <= 0) return null;

  let colorCls: string;
  let label: string;
  if (days >= 10) {
    colorCls = "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800";
    label = `${days}d ⚠️`;
  } else if (days >= 6) {
    colorCls = "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800";
    label = `${days}d`;
  } else if (days >= 3) {
    colorCls = "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800";
    label = `${days}d`;
  } else {
    colorCls = "text-muted-foreground bg-muted/40 border-border";
    label = `${days}d`;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-medium ${colorCls}`}>
            <Clock className="h-2.5 w-2.5 shrink-0" />
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {days === 1 ? "1 dia" : `${days} dias`} nesta coluna
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// React.memo: card só re-renderiza se hu ou colHex mudar.
// Durante drag, o board re-renderiza mas cards não arrastados ficam intactos.
export const KanbanCard = React.memo(function KanbanCard({ hu, colHex }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: hu.id });
  const { developers, epics, activities, workflowColumns, updateUserStoryStatus, addImpediment } = useSprint() as any;

  // ── #10: Lazy mount — dialogs só montados quando abertos pela primeira vez ──
  const [quickOpen,       setQuickOpen]       = useState(false);
  const [quickMounted,    setQuickMounted]    = useState(false);
  const [previewOpen,     setPreviewOpen]     = useState(false);
  const [previewMounted,  setPreviewMounted]  = useState(false);
  const [editOpen,        setEditOpen]        = useState(false);
  const [editMounted,     setEditMounted]     = useState(false);
  const [impedimentOpen,  setImpedimentOpen]  = useState(false);

  const openQuick   = useCallback(() => { setQuickMounted(true);   setQuickOpen(true);   }, []);
  const openPreview = useCallback(() => { setPreviewMounted(true); setPreviewOpen(true); }, []);
  const openEdit    = useCallback(() => { setEditMounted(true);    setEditOpen(true);    }, []);
  // ─────────────────────────────────────────────────────────────────────────

  const [expanded,            setExpanded]            = useState(false);
  const [impedimentReason,    setImpedimentReason]    = useState("");
  const [impedimentStartedAt, setImpedimentStartedAt] = useState(todayISO);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    ...(colHex ? { background: `color-mix(in srgb, ${colHex} 8%, var(--card))`, borderLeft: `3px solid ${colHex}` } : {}),
  };

  const assignee = useMemo(
    () => hu.assigneeId ? developers.find((d: any) => d.id === hu.assigneeId) : null,
    [hu.assigneeId, developers],
  );
  const epic = useMemo(
    () => hu.epicId ? epics.find((e: any) => e.id === hu.epicId) : null,
    [hu.epicId, epics],
  );
  const huActivities = useMemo(
    () => (activities ?? []).filter((a: any) => a.huId === hu.id),
    [activities, hu.id],
  );

  const hasOpenBug    = huActivities.some((a: any) => a.activityType === "bug" && !a.isClosed);
  const assigneeShort = assignee?.name ? formatPersonName(assignee.name) : null;
  const initials      = assignee?.name ? getInitials(assignee.name) : "?";
  const avatarBg      = assignee?.name ? getAvatarColor(assignee.name) : "#6b7280";

  const launchedHours  = getTotalHoursForHU(activities, hu.id);
  const estimatedHours = hu.estimatedHours ?? null;
  const hColors        = hoursColor(launchedHours, estimatedHours);

  const hoursLabel = estimatedHours
    ? `${formatMinutes(Math.round(launchedHours * 60))} / ${formatMinutes(Math.round(estimatedHours * 60))}`
    : `${formatMinutes(Math.round(launchedHours * 60))} lançadas`;

  const showHoursBadge = huActivities.length > 0;
  const overBudget     = estimatedHours && launchedHours > estimatedHours;

  // ── #3: Aging ─────────────────────────────────────────────────────────────────────────────
  const agingDays = calcAgingDays(hu);
  // ─────────────────────────────────────────────────────────────────────────────

  const handleConfirmImpediment = useCallback(async () => {
    const reason = impedimentReason.trim();
    if (!reason) { toast.error("Informe o motivo do impedimento."); return; }
    try {
      if (typeof addImpediment === "function") {
        await addImpediment(hu.id, { reason, startedAt: impedimentStartedAt || undefined });
      }
      toast.success("Impedimento registrado.");
      setImpedimentOpen(false);
      setImpedimentReason("");
      setImpedimentStartedAt(todayISO());
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao registrar impedimento.");
    }
  }, [impedimentReason, impedimentStartedAt, addImpediment, hu.id]);

  const handleCopyId = useCallback(() => {
    navigator.clipboard.writeText(hu.code).then(
      () => toast.success(`ID copiado: ${hu.code}`),
      () => toast.error("Não foi possível copiar."),
    );
  }, [hu.code]);

  return (
    <>
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card
          ref={setNodeRef}
          style={style}
          className="p-3 hover:shadow-md transition-shadow bg-card border group relative"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            openPreview();
          }}
        >
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            {/* Código + bug + prioridade + aging */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-mono text-muted-foreground">{hu.code}</span>
                {hasOpenBug && (
                  <TooltipProvider><Tooltip><TooltipTrigger asChild>
                    <Bug className="h-3 w-3 text-red-500 fill-red-500/30" />
                  </TooltipTrigger><TooltipContent>Bug em aberto</TooltipContent></Tooltip></TooltipProvider>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* ── #3: Aging badge ── */}
                <AgingBadge days={agingDays} colHex={colHex} />
                {hu.priority && (
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${PRIORITY_COLORS[hu.priority] ?? ""}`}>
                    {hu.priority}
                  </Badge>
                )}
              </div>
            </div>

            {/* Épico */}
            {epic && (
              <div className="mb-1 flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: epic.color }} />
                <span className="text-[10px] text-muted-foreground truncate">{epic.name}</span>
              </div>
            )}

            {/* Título */}
            <p className="text-xs font-medium text-foreground line-clamp-3 leading-snug">{hu.title}</p>
          </div>

          {/* Atividades expandidas */}
          {expanded && huActivities.length > 0 && (
            <div className="mt-2 flex flex-col gap-1 border-t pt-2">
              {huActivities.map((a: any) => {
                const dev = developers.find((d: any) => d.id === a.assigneeId);
                const devInitials = dev?.name ? getInitials(dev.name) : null;
                return (
                  <div key={a.id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="truncate flex-1">{a.title}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {a.hours != null && (
                        <span>{formatMinutes(Math.round(Number(a.hours) * 60))}</span>
                      )}
                      {devInitials && <span className="font-semibold text-foreground/70">{devInitials}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Rodapé */}
          <div className="flex items-center justify-between mt-2 gap-1">
            {showHoursBadge ? (
              <div className={`flex items-center gap-1 rounded px-1.5 py-0.5 border text-[10px] font-medium
                ${hColors.text} ${hColors.bg} ${hColors.border}`}>
                <ListChecks className="h-2.5 w-2.5 shrink-0" />
                <span>{huActivities.length}</span>
                <span className="text-muted-foreground mx-0.5">·</span>
                <span>{hoursLabel}</span>
                {overBudget && <AlertTriangle className="h-2.5 w-2.5 ml-0.5 shrink-0" />}
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {hu.estimatedHours != null && (
                  <span>{formatMinutes(Math.round(hu.estimatedHours * 60))} est.</span>
                )}
              </div>
            )}

            <div className="flex items-center gap-1">
              <Button
                type="button" variant="ghost" size="icon"
                className="h-5 w-5 opacity-60 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); openQuick(); }}
                title="Adicionar atividade"
              >
                <Plus className="h-3 w-3" />
              </Button>
              {assignee ? (
                <TooltipProvider><Tooltip><TooltipTrigger asChild>
                  <Avatar className="h-5 w-5">
                    {assignee.avatarUrl || assignee.avatar
                      ? <AvatarImage src={assignee.avatarUrl ?? assignee.avatar} alt={assigneeShort ?? assignee.name} />
                      : null}
                    <AvatarFallback className="text-[8px] font-semibold text-white" style={{ backgroundColor: avatarBg }}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger><TooltipContent>{assigneeShort ?? assignee.name}</TooltipContent></Tooltip></TooltipProvider>
              ) : (
                <Avatar className="h-5 w-5 opacity-50"><AvatarFallback className="text-[8px]">?</AvatarFallback></Avatar>
              )}
            </div>
          </div>
        </Card>
      </ContextMenuTrigger>

      {/* Context menu */}
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={openPreview}>
          <Eye className="h-3.5 w-3.5 mr-2 text-primary" />
          Preview rápido
        </ContextMenuItem>
        <ContextMenuItem onClick={openEdit}>
          <Pencil className="h-3.5 w-3.5 mr-2" />
          Detalhar / Editar HU
        </ContextMenuItem>
        <ContextMenuSeparator />
        {huActivities.length > 0 && (
          <ContextMenuItem onClick={() => setExpanded((v) => !v)}>
            <ListChecks className="h-3.5 w-3.5 mr-2" />
            {expanded ? "Recolher tarefas" : "Ver tarefas"}
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={openQuick}>
          <Plus className="h-3.5 w-3.5 mr-2" />
          Adicionar tarefa
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <ArrowRightLeft className="h-3.5 w-3.5 mr-2" />Mover para
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-44">
            {(workflowColumns ?? []).map((c: any) => (
              <ContextMenuItem
                key={c.key}
                disabled={c.key === hu.status}
                onClick={() => updateUserStoryStatus(hu.id, c.key)}
              >
                <span className="inline-block h-2 w-2 rounded-full mr-2 shrink-0" style={{ background: c.hex ?? "#6b7280" }} />
                {c.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleCopyId}>
          <Copy className="h-3.5 w-3.5 mr-2" />
          Copiar ID da HU
        </ContextMenuItem>
        <ContextMenuItem onClick={() => { setImpedimentReason(""); setImpedimentStartedAt(todayISO()); setImpedimentOpen(true); }}>
          <AlertTriangle className="h-3.5 w-3.5 mr-2 text-amber-500" />
          Reportar impedimento
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>

<<<<<<< HEAD
=======
    {/* ── #10: Lazy mount — só renderiza após primeira abertura ─────────── */}
>>>>>>> origin/main
    {previewMounted && (
      <HUPreviewSheet
        hu={hu}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onEdit={() => { setPreviewOpen(false); openEdit(); }}
      />
    )}

    {editMounted && (
      <HUEditDrawer
        huId={hu.id}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    )}
<<<<<<< HEAD
=======
    {/* ─────────────────────────────────────────────────────────────────── */}
>>>>>>> origin/main

    <AlertDialog open={impedimentOpen} onOpenChange={(o) => { if (!o) { setImpedimentOpen(false); setImpedimentReason(""); setImpedimentStartedAt(todayISO()); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reportar impedimento</AlertDialogTitle>
          <AlertDialogDescription>
            Descreva o impedimento para o card <strong>{hu.code}</strong> — {hu.title}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-2 space-y-3">
          <div>
            <Label htmlFor="impediment-reason" className="text-sm mb-1.5 block">
              Motivo <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="impediment-reason"
              placeholder="Descreva o impedimento..."
              value={impedimentReason}
              onChange={(e) => setImpedimentReason(e.target.value)}
              rows={3} className="resize-none text-sm" autoFocus
            />
          </div>
          <div>
            <Label htmlFor="impediment-started" className="text-sm mb-1.5 block">
              Data de início do impedimento
            </Label>
            <Input
              id="impediment-started" type="date"
              value={impedimentStartedAt}
              onChange={(e) => setImpedimentStartedAt(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmImpediment}
            disabled={!impedimentReason.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            Registrar impedimento
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

<<<<<<< HEAD
=======
    {/* QuickActivity também em lazy mount */}
>>>>>>> origin/main
    {quickMounted && (
      <QuickActivityDialog open={quickOpen} onClose={() => setQuickOpen(false)} huId={hu.id} />
    )}
    </>
  );
});
