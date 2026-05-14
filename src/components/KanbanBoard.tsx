import { useState, useMemo, useCallback, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useSprint } from "@/contexts/SprintContext";
import { useAuth } from "@/contexts/AuthContext";
import { KanbanCard } from "./KanbanCard";
import { KanbanStatus } from "@/types/sprint";
import { toast } from "sonner";
import { ChevronRight, LayoutList, FlagTriangleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { WorkflowColumn } from "@/types/sprint";
import { KanbanFilterBar, KANBAN_FILTROS_DEFAULT } from "./KanbanFilterBar";
import type { KanbanFiltros } from "./KanbanFilterBar";
import { SprintImpedimentsBanner } from "./SprintImpedimentsBanner";
import { supabase } from "@/integrations/supabase/client";

const COLUMN_COLORS: Record<string, string> = {
  backlog:     "#6b7280",
  todo:        "#3b82f6",
  in_progress: "#f59e0b",
  review:      "#8b5cf6",
  done:        "#10b981",
};

// Status considerados "concluídos" — HUs com esses status NÃO são movidas ao encerrar
const DONE_STATUSES = ["pronto_para_publicacao"];

function getColumnHex(col: WorkflowColumn): string {
  if (col.hex) return col.hex;
  return COLUMN_COLORS[col.key] ?? "#6b7280";
}

interface Props {
  sprintId?: string;
  currentUserId?: string;
}

export function KanbanBoard({ sprintId, currentUserId }: Props) {
  const {
    userStories,
    workflowColumns,
    developers,
    sprints,
    updateUserStoryStatus,
    reorderUserStories,
  } = useSprint() as any;

  const { isAdmin, roles } = useAuth();
  const canFinalizeSprint = isAdmin || roles.includes("scrum_master" as any);

  // Sprint ativa (suporta tanto isActive quanto is_active do contexto)
  const activeSprint = useMemo(
    () => (sprints ?? []).find((s: any) => s.isActive || s.is_active) ?? null,
    [sprints],
  );

  const canMove = true;

  const currentSprint = useMemo(
    () => (sprints ?? []).find((s: any) => s.id === sprintId) ?? null,
    [sprints, sprintId],
  );

  const [activeId, setActiveId]         = useState<string | null>(null);
  const [dragOverCol, setDragOverCol]   = useState<string | null>(null);
  const [confirmMove, setConfirmMove]   = useState<{ huId: string; toKey: string } | null>(null);
  const [expandedCols, setExpandedCols] = useState<Set<string>>(
    new Set((workflowColumns ?? []).map((c: WorkflowColumn) => c.key)),
  );
  const [localPositions, setLocalPositions] = useState<Record<string, number>>({});
  const [filtros, setFiltros] = useState<KanbanFiltros>(KANBAN_FILTROS_DEFAULT);

  // Estado do modal de encerramento
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizing,   setFinalizing]   = useState(false);

  useEffect(() => {
    setLocalPositions((prev) => {
      const next = { ...prev };
      userStories.forEach((h: any) => {
        if (!activeId) next[h.id] = h.position ?? 0;
      });
      return next;
    });
  }, [userStories, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const sprintBase = useMemo(() =>
    sprintId ? userStories.filter((h: any) => h.sprintId === sprintId) : userStories,
  [userStories, sprintId]);

  const sprintStories = useMemo(() => {
    let items = sprintBase;
    if (filtros.search.trim()) {
      const q = filtros.search.trim().toLowerCase();
      items = items.filter((h: any) =>
        String(h.title ?? "").toLowerCase().includes(q) ||
        String(h.code  ?? "").toLowerCase().includes(q),
      );
    }
    if (filtros.membros.length > 0) {
      items = items.filter((h: any) =>
        filtros.membros.some((id) =>
          h.assigneeId === id ||
          (Array.isArray(h.assignees) && h.assignees.includes(id)),
        ),
      );
    }
    if (filtros.tipo !== "all")
      items = items.filter((h: any) => h.type === filtros.tipo);
    if (filtros.prioridade !== "all")
      items = items.filter((h: any) => h.priority === filtros.prioridade);
    if (filtros.status !== "all")
      items = items.filter((h: any) => h.status === filtros.status);
    return [...items].sort(
      (a: any, b: any) =>
        (localPositions[a.id] ?? a.position ?? 0) - (localPositions[b.id] ?? b.position ?? 0),
    );
  }, [sprintBase, filtros, localPositions]);

  // Resumo da sprint ativa para exibir no modal
  const sprintSummary = useMemo(() => {
    if (!activeSprint) return null;
    const allCards  = userStories.filter(
      (h: any) => h.sprintId === activeSprint.id || h.sprint_id === activeSprint.id
    );
    const doneCards = allCards.filter((h: any) => DONE_STATUSES.includes(h.status ?? ""));
    return {
      total:      allCards.length,
      done:       doneCards.length,
      incomplete: allCards.length - doneCards.length,
      rate:       allCards.length > 0 ? Math.round((doneCards.length / allCards.length) * 100) : 0,
    };
  }, [activeSprint, userStories]);

  // Encerra a sprint e move HUs incompletas para o backlog (sprint_id = null)
  const handleFinalizeSprint = useCallback(async () => {
    if (!activeSprint) return;
    setFinalizing(true);
    try {
      // 1. Encerra a sprint
      const { error: sprintErr } = await supabase
        .from("sprints")
        .update({ is_active: false, end_date: new Date().toISOString() })
        .eq("id", activeSprint.id);
      if (sprintErr) throw sprintErr;

      // 2. Busca HUs incompletas da sprint
      const { data: incompleteHUs, error: fetchErr } = await supabase
        .from("user_stories")
        .select("id")
        .eq("sprint_id", activeSprint.id)
        .not("status", "in", `(${DONE_STATUSES.map(s => `"${s}"`).join(",")})`);
      if (fetchErr) throw fetchErr;

      // 3. Move HUs incompletas para o backlog (sem sprint) e salva historico
      if (incompleteHUs && incompleteHUs.length > 0) {
        const ids = incompleteHUs.map((h: any) => h.id);
        const { error: updateErr } = await supabase
          .from("user_stories")
          .update({
            sprint_id:          null,
            previous_sprint_id: activeSprint.id,
          })
          .in("id", ids);
        if (updateErr) throw updateErr;
      }

      const incomplete = incompleteHUs?.length ?? 0;
      toast.success(
        `Sprint "${activeSprint.name}" encerrada! ` +
        (incomplete > 0
          ? `${incomplete} HU${incomplete > 1 ? "s" : ""} devolvida${incomplete > 1 ? "s" : ""} ao backlog.`
          : "Todas as HUs foram concluídas! 🎉")
      );
      setFinalizeOpen(false);
    } catch (err: any) {
      console.error("[KanbanBoard] erro ao encerrar sprint:", err);
      toast.error("Erro ao encerrar sprint: " + (err?.message ?? "tente novamente"));
    } finally {
      setFinalizing(false);
    }
  }, [activeSprint]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;
      if (!over) { setDragOverCol(null); return; }
      const overId = String(over.id);
      const colKey = (workflowColumns ?? []).find((c: WorkflowColumn) => c.key === overId)?.key;
      if (colKey) { setDragOverCol(colKey); return; }
      const overHu = sprintStories.find((h: any) => h.id === overId);
      setDragOverCol(overHu?.status ?? null);
    },
    [workflowColumns, sprintStories],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      setDragOverCol(null);
      const { active, over } = event;
      if (!over || !canMove) return;
      const activeIdStr = String(active.id);
      const overIdStr   = String(over.id);
      if (activeIdStr === overIdStr) return;
      const draggedHu = sprintStories.find((h: any) => h.id === activeIdStr);
      if (!draggedHu) return;
      const targetColKey =
        (workflowColumns ?? []).find((c: WorkflowColumn) => c.key === overIdStr)?.key ??
        sprintStories.find((h: any) => h.id === overIdStr)?.status;
      if (!targetColKey) return;
      if (draggedHu.status === targetColKey) {
        const colItems = sprintStories.filter((h: any) => h.status === draggedHu.status);
        const oldIdx = colItems.findIndex((h: any) => h.id === activeIdStr);
        const newIdx = colItems.findIndex((h: any) => h.id === overIdStr);
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
        const reordered = arrayMove(colItems, oldIdx, newIdx);
        const updates   = reordered.map((h: any, idx: number) => ({ id: h.id, position: idx }));
        setLocalPositions((prev) => {
          const next = { ...prev };
          updates.forEach(({ id, position }: any) => { next[id] = position; });
          return next;
        });
        reorderUserStories(updates);
      } else {
        setConfirmMove({ huId: draggedHu.id, toKey: targetColKey });
      }
    },
    [canMove, sprintStories, workflowColumns, reorderUserStories],
  );

  const handleConfirmMove = useCallback(async () => {
    if (!confirmMove) return;
    try {
      await updateUserStoryStatus(confirmMove.huId, confirmMove.toKey as KanbanStatus);
      toast.success("Card movido com sucesso");
    } catch {
      toast.error("Erro ao mover card");
    } finally {
      setConfirmMove(null);
    }
  }, [confirmMove, updateUserStoryStatus]);

  const activeHu = activeId ? sprintStories.find((h: any) => h.id === activeId) : null;

  function toggleCol(key: string) {
    setExpandedCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <>
      {/* ── Banner de impedimentos da sprint ── */}
      {currentSprint && (
        <div className="mb-3">
          <SprintImpedimentsBanner sprint={currentSprint} />
        </div>
      )}

      {/* ── Botão Finalizar Sprint (só admin e scrum_master) ── */}
      {canFinalizeSprint && activeSprint && (
        <div className="flex justify-end mb-3">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-amber-500/50 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/30"
            onClick={() => setFinalizeOpen(true)}
          >
            <FlagTriangleRight className="h-3.5 w-3.5" />
            Finalizar Sprint
          </Button>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="rounded-xl border border-border/60 bg-card px-4 py-3 mb-4">
        <KanbanFilterBar
          filtros={filtros}
          onChange={setFiltros}
          stories={sprintBase}
          developers={developers ?? []}
          workflowColumns={workflowColumns ?? []}
          totalFiltrado={sprintStories.length}
          currentUserId={currentUserId}
        />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 items-start">
          {(workflowColumns ?? []).map((col: WorkflowColumn) => {
            const colHex   = getColumnHex(col);
            const colItems = sprintStories.filter((h: any) => h.status === col.key);
            const isExpanded = expandedCols.has(col.key);
            const isOver     = dragOverCol === col.key;

            if (!isExpanded) {
              return (
                <div
                  key={col.key}
                  onClick={() => toggleCol(col.key)}
                  title={`Expandir ${col.label}`}
                  className="flex flex-col items-center rounded-xl border cursor-pointer select-none transition-all duration-200 hover:opacity-80 shrink-0"
                  style={{
                    width: 44, minHeight: 180,
                    background: `color-mix(in srgb, ${colHex} 5%, var(--background))`,
                    borderColor: `color-mix(in srgb, ${colHex} 30%, transparent)`,
                  }}
                >
                  <div className="w-full flex items-center justify-center rounded-t-xl py-2" style={{ background: colHex }}>
                    <ChevronRight className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 flex items-center justify-center py-3">
                    <span
                      className="text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap"
                      style={{ writingMode: "vertical-rl" as React.CSSProperties["writingMode"], transform: "rotate(180deg)", color: colHex, maxHeight: 200, overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {col.label}
                    </span>
                  </div>
                  <div className="pb-3 flex flex-col items-center gap-1">
                    <LayoutList className="h-3 w-3" style={{ color: colHex, opacity: 0.6 }} />
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: colHex }}>{colItems.length}</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={col.key}
                className={`flex flex-col rounded-xl border transition-all duration-200 shrink-0 ${ isOver ? "ring-2 ring-offset-1" : "ring-0" }`}
                style={{
                  width: 260,
                  background: `color-mix(in srgb, ${colHex} 5%, var(--background))`,
                  borderColor: `color-mix(in srgb, ${colHex} 30%, transparent)`,
                  ...(isOver ? { "--tw-ring-color": colHex } as React.CSSProperties : {}),
                }}
              >
                <div
                  className="flex items-center justify-between px-3 py-2.5 rounded-t-xl cursor-pointer select-none"
                  style={{ borderBottom: `2px solid ${colHex}` }}
                  onClick={() => toggleCol(col.key)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronRight className="h-3 w-3 shrink-0 rotate-90" style={{ color: colHex }} />
                    <span className="text-xs font-semibold truncate uppercase tracking-wider" style={{ color: colHex }}>{col.label}</span>
                  </div>
                  <span
                    className="text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ml-2 shrink-0"
                    style={{ background: `color-mix(in srgb, ${colHex} 18%, transparent)`, color: colHex }}
                  >
                    {colItems.length}
                  </span>
                </div>

                <SortableContext items={colItems.map((h: any) => h.id)} strategy={verticalListSortingStrategy}>
                  <div id={col.key} className="flex flex-col gap-2 p-2 min-h-[80px] max-h-[calc(100vh-300px)] overflow-y-auto">
                    {colItems.map((hu: any) => {
                      const isDragging = hu.id === activeId;
                      return (
                        <div key={hu.id} style={{ opacity: isDragging ? 0.3 : 1, transition: "opacity 0.15s" }}>
                          <KanbanCard hu={hu} colHex={colHex} />
                        </div>
                      );
                    })}
                    {colItems.length === 0 && (
                      <div
                        className="flex items-center justify-center h-16 rounded-lg border-2 border-dashed text-[11px] text-muted-foreground/50 transition-colors"
                        style={{ borderColor: isOver ? `color-mix(in srgb, ${colHex} 50%, transparent)` : undefined, color: isOver ? colHex : undefined }}
                      >
                        {isOver ? "Soltar aqui" : "Sem cards"}
                      </div>
                    )}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
          {activeHu && (
            <div className="rotate-1 scale-105 shadow-2xl rounded-xl opacity-95 pointer-events-none" style={{ width: 252 }}>
              <KanbanCard hu={activeHu} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* ── Modal mover card ── */}
      <AlertDialog open={!!confirmMove} onOpenChange={(o) => !o && setConfirmMove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover card?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja mover este card para a coluna{" "}
              <strong>{(workflowColumns ?? []).find((c: WorkflowColumn) => c.key === confirmMove?.toKey)?.label ?? confirmMove?.toKey}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMove}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Modal Finalizar Sprint ── */}
      <AlertDialog open={finalizeOpen} onOpenChange={(o) => { if (!finalizing) setFinalizeOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FlagTriangleRight className="h-5 w-5 text-amber-500" />
              Encerrar Sprint
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {activeSprint && (
                  <p>Você está prestes a encerrar a sprint <strong>"{activeSprint.name}"</strong>.</p>
                )}
                {sprintSummary && (
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total de HUs:</span>
                      <strong>{sprintSummary.total}</strong>
                    </div>
                    <div className="flex justify-between text-xs text-emerald-600">
                      <span>Concluídas (pronto para publicação):</span>
                      <strong>{sprintSummary.done}</strong>
                    </div>
                    <div className="flex justify-between text-xs text-amber-600">
                      <span>Incompletas (voltam ao backlog):</span>
                      <strong>{sprintSummary.incomplete}</strong>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Taxa de conclusão:</span>
                      <strong>{sprintSummary.rate}%</strong>
                    </div>
                  </div>
                )}
                {sprintSummary && sprintSummary.incomplete > 0 && (
                  <p className="text-xs text-muted-foreground rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-2">
                    ⚠️ As <strong>{sprintSummary.incomplete} HU{sprintSummary.incomplete > 1 ? "s" : ""} incompleta{sprintSummary.incomplete > 1 ? "s" : ""}</strong> serão devolvidas ao backlog sem sprint associada, mantendo épico e histórico de qual sprint vieram.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={finalizing}
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={(e) => { e.preventDefault(); handleFinalizeSprint(); }}
            >
              {finalizing ? "Encerrando..." : "Confirmar Encerramento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
