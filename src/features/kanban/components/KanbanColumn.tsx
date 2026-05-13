import { Badge }  from "@/components/ui/badge";
import { KanbanCardItem } from "./KanbanCardItem";
import type { KanbanColumn as KanbanColumnType, KanbanCard } from "../hooks/useKanbanBoard";

interface Props {
  column:      KanbanColumnType;
  cards:       KanbanCard[];
  wipCount:    number;
  draggingId:  string | null;
  onDragStart: (id: string) => void;
  onDragEnd:   () => void;
  onDrop:      (colKey: string) => void;
}

export function KanbanColumnItem({ column, cards, wipCount, draggingId, onDragStart, onDragEnd, onDrop }: Props) {
  const isOverLimit = column.wip_limit !== null && wipCount > column.wip_limit;
  const isAtLimit   = column.wip_limit !== null && wipCount === column.wip_limit;

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop     = (e: React.DragEvent) => { e.preventDefault(); onDrop(column.key); };

  return (
    <div
      className={`flex flex-col rounded-xl border-2 min-h-[400px] min-w-[220px] w-full transition-colors ${
        isOverLimit ? "border-destructive/60 bg-destructive/5" :
        isAtLimit   ? "border-orange-400/60 bg-orange-50/30 dark:bg-orange-950/10" :
        "border-border bg-muted/20"
      }`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header da coluna */}
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: column.hex ?? column.dot_color }}
          />
          <span className="text-xs font-semibold">{column.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant={isOverLimit ? "destructive" : isAtLimit ? "secondary" : "outline"}
            className="text-[10px] px-1.5"
          >
            {wipCount}{column.wip_limit !== null ? `/${column.wip_limit}` : ""}
          </Badge>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2.5 space-y-2 overflow-y-auto">
        {cards.map(card => (
          <KanbanCardItem
            key={card.id}
            card={card}
            isDragging={draggingId === card.id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
        {cards.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground opacity-50">
            Arraste um card aqui
          </div>
        )}
      </div>
    </div>
  );
}
