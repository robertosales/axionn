import { useRef } from "react";
import { Badge }          from "@/components/ui/badge";
import { KanbanCardItem } from "./KanbanCardItem";
import type { KanbanCard, KanbanColumn } from "../hooks/useKanbanBoard";

interface Props {
  column:      KanbanColumn;
  cards:       KanbanCard[];
  wipCount:    number;
  draggingId:  string | null;
  onDragStart: (id: string) => void;
  onDragEnd:   () => void;
  onDrop:      (cardId: string, colKey: string) => void;
  onCardClick?: (card: KanbanCard) => void;
}

export function KanbanColumnItem({
  column, cards, wipCount, draggingId,
  onDragStart, onDragEnd, onDrop, onCardClick,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const wipOver = column.wip_limit !== null && wipCount > column.wip_limit;
  const wipWarn = column.wip_limit !== null && wipCount === column.wip_limit;

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const handleDrop     = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) onDrop(id, column.key);
  };

  return (
    <div
      ref={ref}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex w-full min-w-[240px] max-w-[280px] snap-start flex-col"
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-2 py-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: column.hex ?? "#94a3b8" }}
          />
          <span className="text-xs font-semibold truncate">{column.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <Badge
            variant="outline"
            className={`text-[9px] px-1.5 py-0 ${
              wipOver ? "border-destructive text-destructive" :
              wipWarn ? "border-yellow-500 text-yellow-600" : ""
            }`}
          >
            {wipCount}{column.wip_limit !== null ? `/${column.wip_limit}` : ""}
          </Badge>
        </div>
      </div>

      {/* Drop zone */}
      <div className="min-h-[120px] flex-1 space-y-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm transition-all duration-300 hover:border-indigo-200">
        {cards.map(card => (
          <KanbanCardItem
            key={card.id}
            card={card}
            isDragging={draggingId === card.id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={onCardClick}
          />
        ))}
        {cards.length === 0 && (
          <div className="flex items-center justify-center h-16 text-[10px] text-muted-foreground/50">
            Sem HUs
          </div>
        )}
      </div>
    </div>
  );
}
