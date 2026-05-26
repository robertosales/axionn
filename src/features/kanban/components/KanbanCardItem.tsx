import { Badge }  from "@/components/ui/badge";
import { AlertTriangle, GripVertical } from "lucide-react";
import type { KanbanCard } from "../hooks/useKanbanBoard";

const PRIORITY_COLOR: Record<string, string> = {
  high:   "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low:    "bg-green-100 text-green-700 border-green-200",
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "Alta", medium: "Média", low: "Baixa",
};

/** Gera iniciais a partir do nome completo. Ex: "Roberto de Araujo Sales" → "RS" */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

interface Props {
  card:        KanbanCard;
  isDragging:  boolean;
  onDragStart: (id: string) => void;
  onDragEnd:   () => void;
  onClick?:    (card: KanbanCard) => void;
}

export function KanbanCardItem({ card, isDragging, onDragStart, onDragEnd, onClick }: Props) {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("text/plain", card.id);
    e.dataTransfer.effectAllowed = "move";
    onDragStart(card.id);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Não abre detalhe se estiver arrastando
    if (isDragging) return;
    e.stopPropagation();
    onClick?.(card);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={handleClick}
      className={`rounded-lg border bg-background p-3 space-y-2 cursor-pointer shadow-sm transition-all ${
        isDragging ? "opacity-40 scale-95" : "hover:shadow-md hover:border-primary/40"
      } ${
        card.is_blocked ? "border-destructive/50 bg-destructive/5" : ""
      }`}
    >
      {/* Header: código + grip */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted-foreground">{card.code}</span>
        <div className="flex items-center gap-1">
          {card.is_blocked && <AlertTriangle className="h-3 w-3 text-destructive" />}
          <GripVertical className="h-3 w-3 text-muted-foreground/40" />
        </div>
      </div>

      {/* Título */}
      <p className="text-xs font-medium leading-snug line-clamp-2">{card.title}</p>

      {/* Epic */}
      {card.epic_name && (
        <div className="flex items-center gap-1">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: card.epic_color ?? "#6366f1" }}
          />
          <span className="text-[10px] text-muted-foreground truncate">{card.epic_name}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${PRIORITY_COLOR[card.priority] ?? ""}` }>
            {PRIORITY_LABEL[card.priority] ?? card.priority}
          </Badge>
          {card.story_points > 0 && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{card.story_points}pt</Badge>
          )}
        </div>

        {/* Avatar com iniciais duplas ou foto */}
        <div className="flex items-center gap-1">
          {card.assignee_avatar ? (
            <img
              src={card.assignee_avatar}
              alt={card.assignee_name ?? "Assignee"}
              title={card.assignee_name}
              className="h-6 w-6 rounded-full object-cover border border-border"
            />
          ) : card.assignee_name ? (
            <div
              title={card.assignee_name}
              className="h-6 w-6 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-[9px] font-bold text-primary select-none"
            >
              {getInitials(card.assignee_name)}
            </div>
          ) : (
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
              <span className="text-[9px] text-muted-foreground">—</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
