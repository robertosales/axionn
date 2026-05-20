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
  useDroppable,
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

// ─── Chaves de sessionStorage ─────────────────────────────────────────────────
const SS_FILTROS_KEY   = "kanban_board_filtros";
const SS_EXPANDED_KEY  = "kanban_board_expanded_cols";

function loadFiltros(): KanbanFiltros | null {
  try {
    const raw = sessionStorage.getItem(SS_FILTROS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as KanbanFiltros;
  } catch { return null; }
}

function saveFiltros(f: KanbanFiltros) {
  try { sessionStorage.setItem(SS_FILTROS_KEY, JSON.stringify(f)); } catch {}
}

function loadExpandedCols(allKeys: string[]): Set<string> {
  try {
    const raw = sessionStorage.getItem(SS_EXPANDED_KEY);
    if (!raw) return new Set(allKeys); // padrão: tudo expandido
    const parsed = JSON.parse(raw) as string[];
    // Garante que novas colunas adicionadas após salvar apareçam expandidas
    const saved = new Set(parsed);
    allKeys.forEach((k) => { if (!parsed.includes(k) && !parsed.includes(`__hidden__${k}`)) saved.add(k); });
    // Remove prefixo de colunas explicitamente recolhidas
    const hiddenKeys = parsed.filter((k) => k.startsWith("__hidden__")).map((k) => k.replace("__hidden__", ""));
    hiddenKeys.forEach((k) => saved.delete(k));
    return saved;
  } catch { return new Set(allKeys); }
}

function saveExpandedCols(expanded: Set<string>, allKeys: string[]) {
  try {
    // Salva expanded + marca os recolhidos com prefixo para distinguir "nunca visto" de "recolhido"
    const payload: string[] = [
      ...Array.from(expanded),
      ...allKeys.filter((k) => !expanded.has(k)).map((k) => `__hidden__${k}`),
    ];
    sessionStorage.setItem(SS_EXPANDED_KEY, JSON.stringify(payload));
  } catch {}
}
// ─────────────────────────────────────────────────────────────────────────────

const COLUMN_COLORS: Record<string, string> = {
  backlog:     "#6b7280",
  todo:        "#3b82f6",
  in_progress: "#f59e0b",
  review:      "#8b5cf6",
  done:        "#10b981",
};

const DONE_STATUSES = ["pronto_para_publicacao"];

function getColumnHex(col: WorkflowColumn): string {
  if (col.hex) return col.hex;
  return COLUMN_COLORS[col.key] ?? "#6b7280";
}

function DroppableColumn({
  colKey,
  colHex,
  isOver,
  activeId,
  colItems,
}: {
  colKey: string;
  colHex: string;
  isOver: boolean;
  activeId: string | null;
  colItems: any[];
}) {
  const { setNodeRef } = useDroppable({ id: colKey });

  return (
    <SortableContext items={colItems.map((h: any) => h.id)} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className="flex flex-col gap-2 p-2 min-h-[80px] max-h-[calc(100vh-300px)] overflow-y-auto"
      >
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
            style={{
              borderColor: isOver ? `color-mix(in srgb, ${colHex} 50%, transparent)` : undefined,
              color: isOver ? colHex : undefined,
            }}
          >
            {isOver ? "Soltar aqui" : "Sem cards"}
          </div>
        )}
      </div>
    </SortableContext>
  );
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
    refreshAll,
  } = useSprint() as any;

  const { isAdmin, roles } = useAuth();
  const canFinalizeSprint = isAdmin || roles.includes("scrum_master" as any);

  const activeSprint = useMemo(
    () => (sprints ?? []).find((s: any) => s.isActive || s.is_active) ?? null,
    [sprints],
  );

  // ── #4: Filtros persistidos em sessionStorage ─────────────────────────────
  const [filtros, setFiltros] = useState<KanbanFiltros>(() => {
    const saved = loadFiltros();
    if (saved) return saved;
    return { ...KANBAN_FILTROS_DEFAULT, sprintId: "all" };
  });

  const handleFiltrosChange = useCallback((next: KanbanFiltros) => {
    setFiltros(next);
    saveFiltros(next);
  }, []);

  // Auto-seleciona sprint ativa apenas se filtro ainda estiver em "all" e não houver filtro salvo
  useEffect(() => {
    if (!activeSprint) return;
    setFiltros((prev) => {
      if (prev.sprintId === "all") {
        const next = { ...prev, sprintId: activeSprint.id };
        saveFiltros(next);
        return next;
      }
      return prev;
    });
  }, [activeSprint?.id]);
  // ─────────────────────────────────────────────────────────────────────────

  const canMove = true;

  const selectedSprint = useMemo(
    () => (sprints ?? []).find((s: any) => s.id === filtros.sprintId) ?? null,
    [sprints, filtros.sprintId],
  );

  const currentSprint = useMemo(
    () => (sprints ?? []).find((s: any) => s.id === (sprintId ?? filtros.sprintId)) ?? selectedSprint,
    [sprints, sprintId, filtros.sprintId, selectedSprint],
  );

  const sprintFinalizavel = useMemo(() => {
    if (!selectedSprint) return null;
    const isAtiva = selectedSprint.isActive || selectedSprint.is_active;
    const endDate = selectedSprint.endDate || selectedSprint.end_date;
    const isGhost = !isAtiva && !endDate;
    return (isAtiva || isGhost) ? selectedSprint : null;
  }, [selectedSprint]);

  const [activeId, setActiveId]       = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // ── #5: Colunas expandidas persistidas em sessionStorage ─────────────────
  const allColKeys = useMemo(
    () => (workflowColumns ?? []).map((c: WorkflowColumn) => c.key),
    [workflowColumns],
  );

  const [expandedCols, setExpandedCols] = useState<Set<string>>(
    () => loadExpandedCols(allColKeys),
  );

  // Quando workflowColumns chegar (assíncrono), re-hidrata se o estado ainda for vazio
  useEffect(() => {
    if (allColKeys.length === 0) return;
    setExpandedCols((prev) => {
      if (prev.size > 0) return prev; // já hidratado
      return loadExpandedCols(allColKeys);
    });
  }, [allColKeys.join(",")]);

  function toggleCol(key: string) {
    setExpandedCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveExpandedCols(next, allColKeys);
      return next;
    });
  }
  // ─────────────────────────────────────────────────────────────────────────

  const [localPositions, setLocalPositions] = useState<Record<string, number>>({});
  const [finalizeOpen, setFinalizeOpen]     = useState(false);
  const [finalizing, setFinalizing]         = useState(false);

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

  const sprintBase = useMemo(() => {
    if (filtros.sprintId === "all") {
      return sprintId ? userStories.filter((h: any) => h.sprintId === sprintId) : userStories;
    }
    return userStories.filter(
      (h: any) => (h.sprintId || h.sprint_id) === filtros.sprintId,
    );
  }, [userStories, sprintId, filtros.sprintId]);

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

  const sprintSummary = useMemo(() => {
    if (!sprintFinalizavel) return null;
    const allCards  = userStories.filter(
      (h: any) => (h.sprintId || h.sprint_id) === sprintFinalizavel.id
    );
    const doneCards = allCards.filter((h: any) => DONE_STATUSES.includes(h.status ?? ""));
    return {
      total:      allCards.length,
      done:       doneCards.length,
      incomplete: allCards.length - doneCards.length,
      rate:       allCards.length > 0 ? Math.round((doneCards.length / allCards.length) * 100) : 0,
    };
  }, [sprintFinalizavel, userStories]);

  const handleFinalizeSprint = useCallback(async () => {
    if (!sprintFinalizavel) return;
    setFinalizing(true);
    try {
      const { error: sprintErr } = await supabase
        .from("sprints")
        .update({ is_active: false, end_date: new Date().toISOString() })
        .eq("id", sprintFinalizavel.id);
      if (sprintErr) throw sprintErr;

      const { data: incompleteHUs, error: fetchErr } = await supabase
        .from("user_stories")
        .select("id")
        .eq("sprint_id", sprintFinalizavel.id)
        .not("status", "in", `(${DONE_STATUSES.map(s => `"${s}"`).join(",")})`);
      if (fetchErr) throw fetchErr;

      if (incompleteHUs && incompleteHUs.length > 0) {
        const ids = incompleteHUs.map((h: any) => h.id);
        const { error: updateErr } = await supabase
          .from("user_stories")
          .update({
            sprint_id:          null,
            previous_sprint_id: sprintFinalizavel.id,
          })
          .in("id", ids);
        if (updateErr) throw updateErr;
      }

      const incomplete = incompleteHUs?.length ?? 0;
      toast.success(
        `Sprint "${sprintFinalizavel.name}" encerrada! ` +
        (incomplete > 0
          ? `${incomplete} HU${incomplete > 1 ? "s" : ""} devolvida${incomplete > 1 ? "s" : ""} ao backlog.`
          : "Todas as HUs foram concluídas! 🎉")
      );
      setFinalizeOpen(false);

      const newActive = (sprints ?? []).find(
        (s: any) => (s.isActive || s.is_active) && s.id !== sprintFinalizavel.id
      );
      const next = { ...filtros, sprintId: newActive?.id ?? "all" };
      setFiltros(next);
      saveFiltros(next);

      await refreshAll();
    } catch (err: any) {
      console.error("[KanbanBoard] erro ao encerrar sprint:", err);
      toast.error("Erro ao encerrar sprint: " + (err?.message ?? "tente novamente"));
    } finally {
      setFinalizing(false);
    }
  }, [sprintFinalizavel, sprints, filtros, refreshAll]);

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
    async (event: DragEndEvent) => {
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
        try {
          await updateUserStoryStatus(draggedHu.id, targetColKey as KanbanStatus);
        } catch {
          toast.error("Erro ao mover card");
        }
      }
    },
    [canMove, sprintStories, workflowColumns, reorderUserStories, updateUserStoryStatus],
  );

  const activeHu = activeId ? sprintStories.find((h: any) => h.id === activeId) : null;

  return (
    <>
      {currentSprint && (
        <div className="mb-3">
          <SprintImpedimentsBanner sprint={currentSprint} />
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-card px-4 py-3 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <KanbanFilterBar
              filtros={filtros}
              onChange={handleFiltrosChange}
              stories={userStories}
              developers={developers ?? []}
              workflowColumns={workflowColumns ?? []}
              sprints={sprints ?? []}
              totalFiltrado={sprintStories.length}
              currentUserId={currentUserId}
            />
          </div>
          {canFinalizeSprint && sprintFinalizavel && (
            <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
              {!(sprintFinalizavel.isActive || sprintFinalizavel.is_active) && (
                <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                  ⚠️ Sprint não encerrada formalmente
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-amber-500/50 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/30"
                onClick={() => setFinalizeOpen(true)}
              >
                <FlagTriangleRight className="h-3.5 w-3.5" />
                {sprintFinalizavel.isActive || sprintFinalizavel.is_active
                  ? "Finalizar Sprint"
                  : "Encerrar Sprint Pendente"
                }
              </Button>
            </div>
          )}
        </div>
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

                <DroppableColumn
                  colKey={col.key}
                  colHex={colHex}
                  isOver={isOver}
                  activeId={activeId}
                  colItems={colItems}
                />
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

      <AlertDialog open={finalizeOpen} onOpenChange={(o) => { if (!finalizing) setFinalizeOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FlagTriangleRight className="h-5 w-5 text-amber-500" />
              {sprintFinalizavel?.isActive || sprintFinalizavel?.is_active
                ? "Encerrar Sprint"
                : "Encerrar Sprint Pendente"
              }
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {sprintFinalizavel && (
                  <p>Você está prestes a encerrar a sprint <strong>"{sprintFinalizavel.name}"</strong>.</p>
                )}
                {!(sprintFinalizavel?.isActive || sprintFinalizavel?.is_active) && (
                  <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-2 rounded-lg">
                    ⚠️ Esta sprint não foi encerrada formalmente. Encerá-la agora irá marcar a data de término como hoje e mover as HUs incompletas para o backlog.
                  </p>
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
