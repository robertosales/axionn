import { useKanbanBoard } from "../hooks/useKanbanBoard";
import { useFinalizeSprint } from "../hooks/useFinalizeSprint";
import { KanbanFiltersBar } from "../components/KanbanFilters";
import { KanbanColumnItem } from "../components/KanbanColumn";
import { FinalizeSprintModal } from "../components/FinalizeSprintModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge }   from "@/components/ui/badge";
import { Button }  from "@/components/ui/button";
import { RefreshCw, Layers, FlagTriangleRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function KanbanPage() {
  // Todos vêem o Kanban. Só admin e scrum_master podem encerrar sprint.
  const { isAdmin, profile } = useAuth();
  const canFinalizeSprint = isAdmin
    || (profile as any)?.role === "scrum_master"
    || profile?.module_access === "admin";

  const {
    columns, filteredCards, cards, devs, epics, sprints,
    loading, filters, setFilters,
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

  if (loading) return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-10 w-full" />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-[400px] min-w-[220px] w-full rounded-xl" />)}
      </div>
    </div>
  );

  const renderBoard = (devFilter?: string) => (
    <div className="flex gap-3 overflow-x-auto pb-4">
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
            onDrop={colKey => {
              if (dragging) moveCard(dragging, colKey);
              setDragging(null);
            }}
          />
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4 p-4">
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
        </div>
        <div className="flex items-center gap-2">
          {canFinalizeSprint && activeSprint && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-amber-500/50 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/30"
              onClick={openModal}
            >
              <FlagTriangleRight className="h-3.5 w-3.5" />
              Finalizar Sprint
            </Button>
          )}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={reload}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <KanbanFiltersBar
        filters={filters}
        onChange={setFilters}
        devs={devs}
        epics={epics}
        sprints={sprints as any}
        totalVisible={filteredCards.length}
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
                  {filteredCards.filter(c => (dev.id === "__unassigned__" ? !c.assignee_id : c.assignee_id === dev.id)).length} HUs
                </Badge>
              </div>
              {renderBoard(dev.id)}
            </div>
          ))}
        </div>
      ) : (
        renderBoard()
      )}

      <FinalizeSprintModal
        open={modalOpen}
        onClose={closeModal}
        summary={summary}
        loading={finalizing}
        sprints={sprints as any}
        onConfirm={finalize}
      />
    </div>
  );
}
