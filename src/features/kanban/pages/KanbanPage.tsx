import React, { useState, useRef, useEffect, useCallback } from "react";
import { useKanbanBoard }          from "../hooks/useKanbanBoard";
import { useFinalizeSprint }       from "../hooks/useFinalizeSprint";
import { KanbanFilters as KanbanFiltersBarRaw } from "../components/KanbanFilters";
const KanbanFiltersBar = KanbanFiltersBarRaw as unknown as React.FC<any>;
import { KanbanColumnItem }        from "../components/KanbanColumn";
import { FinalizeSprintModal }     from "../components/FinalizeSprintModal";
import { UserStoryDetailModal }    from "../components/UserStoryDetailModal";
import { Skeleton }   from "@/components/ui/skeleton";
import { Badge }      from "@/components/ui/badge";
import { Button }     from "@/components/ui/button";
import { RefreshCw, Layers, Loader2, ChevronDown } from "lucide-react";
import { useAuth }    from "@/contexts/AuthContext";
import type { KanbanCard } from "../hooks/useKanbanBoard";

// ── KanbanLoadMoreTrigger ─────────────────────────────────────────────────────
// Sentinela invisível + botão de fallback para carregar próxima página.
// Só renderizado quando filters.sprintId === 'all'.
interface LoadMoreProps {
  hasMore:     boolean;
  loading:     boolean;
  onLoadMore:  () => void;
}

function KanbanLoadMoreTrigger({ hasMore, loading, onLoadMore }: LoadMoreProps) {
  const sentinelaRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver: dispara fetchMoreCards quando o sentinela entra no viewport
  useEffect(() => {
    if (!hasMore || loading) return;
    const el = sentinelaRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) onLoadMore(); },
      { rootMargin: "200px" }, // antecipa 200px antes de chegar no elemento
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  if (!hasMore) return null;

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      {/* Sentinela invisível — alvo do IntersectionObserver */}
      <div ref={sentinelaRef} aria-hidden className="h-1 w-full" />

      {/* Botão de fallback explícito */}
      <Button
        variant="outline"
        size="sm"
        onClick={onLoadMore}
        disabled={loading}
        className="gap-2 text-xs text-muted-foreground"
      >
        {loading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <ChevronDown className="h-3.5 w-3.5" />}
        {loading ? "Carregando..." : "Carregar mais cards"}
      </Button>
    </div>
  );
}

// ── KanbanPage ────────────────────────────────────────────────────────────────
export function KanbanPage() {
  const { isAdmin, profile } = useAuth();
  const canFinalizeSprint = isAdmin
    || (profile as any)?.role === "scrum_master"
    || profile?.module_access === "admin";

  const {
    columns, filteredCards, cards, devs, epics, sprints,
    loading, loadingMore, hasMoreCards, fetchMoreCards,
    filters, setFilters,
    dragging, setDragging,
    moveCard, wipCounts, swimlaneDevs,
    reload,
  } = useKanbanBoard();

  const {
    open: modalOpen,
    openModal,
    closeModal,
    summary,
    loading: finalizing,
    finalize,
    activeSprint,
  } = useFinalizeSprint(cards, columns, sprints as any, reload);

  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [detailOpen,   setDetailOpen]   = useState(false);

  const handleCardClick  = (card: KanbanCard) => { setSelectedCard(card); setDetailOpen(true); };
  const handleDetailClose = () => { setDetailOpen(false); setSelectedCard(null); };
  const handleCardMoved  = (cardId: string, newStatus: string) => moveCard(cardId, newStatus);

  // Estabiliza referência de fetchMoreCards para o IntersectionObserver
  const fetchMoreRef = useRef(fetchMoreCards);
  useEffect(() => { fetchMoreRef.current = fetchMoreCards; }, [fetchMoreCards]);
  const stableFetchMore = useCallback(() => fetchMoreRef.current?.(), []);

  if (loading) return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-10 w-full" />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-[400px] min-w-[220px] w-full rounded-xl" />)}
      </div>
    </div>
  );

  const renderBoard = (devFilter?: string) => (
    <div className="flex snap-x gap-3 overflow-x-auto pb-4">
      {columns.map(col => {
        let colCards = filteredCards.filter(c => c.status === col.key);
        if (devFilter !== undefined) {
          colCards = colCards.filter(c =>
            devFilter === "__unassigned__" ? !c.assignee_id : c.assignee_id === devFilter
          );
        }
        return (
          <KanbanColumnItem
            key={col.id}
            column={col}
            cards={colCards.sort((a, b) => a.position - b.position)}
            wipCount={devFilter === undefined ? (wipCounts[col.key] ?? 0) : colCards.length}
            draggingId={dragging}
            onDragStart={id => setDragging(id)}
            onDragEnd={() => setDragging(null)}
            onDrop={(cardId, colKey) => { moveCard(cardId, colKey); setDragging(null); }}
            onCardClick={handleCardClick}
          />
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Kanban</h1>
          <Badge variant="outline" className="text-[10px]">
            {filteredCards.length} HU{filteredCards.length !== 1 ? "s" : ""}
          </Badge>
          {activeSprint && (
            <Badge variant="secondary" className="text-[10px]">
              {activeSprint.name}
            </Badge>
          )}
          {/* Badge de paginação: só aparece no modo all com mais páginas */}
          {filters.sprintId === "all" && hasMoreCards && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              parcial
            </Badge>
          )}
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={reload}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <KanbanFiltersBar
        filters={filters}
        onChange={setFilters}
        devs={devs}
        epics={epics}
        sprints={sprints as any}
        totalVisible={filteredCards.length}
        showFinalize={canFinalizeSprint && !!activeSprint}
        onFinalizeSprint={openModal}
      />

      {filters.swimlane && swimlaneDevs.length > 0 ? (
        <div className="space-y-6">
          {swimlaneDevs.map(dev => (
            <div key={dev.id}>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                  {dev.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-semibold">{dev.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {filteredCards.filter(c =>
                    dev.id === "__unassigned__" ? !c.assignee_id : c.assignee_id === dev.id
                  ).length} HUs
                </Badge>
              </div>
              {renderBoard(dev.id)}
            </div>
          ))}
        </div>
      ) : (
        renderBoard()
      )}

      {/* Trigger de carregar mais — só no modo sprintFilter=all */}
      {filters.sprintId === "all" && (
        <KanbanLoadMoreTrigger
          hasMore={hasMoreCards ?? false}
          loading={loadingMore ?? false}
          onLoadMore={stableFetchMore}
        />
      )}

      <FinalizeSprintModal
        open={modalOpen}
        onClose={closeModal}
        summary={summary}
        loading={finalizing}
        sprints={sprints as any}
        onConfirm={finalize}
      />

      <UserStoryDetailModal
        card={selectedCard}
        columns={columns}
        devs={devs}
        open={detailOpen}
        onClose={handleDetailClose}
        onMoved={handleCardMoved}
        onReload={reload}
      />
    </div>
  );
}
