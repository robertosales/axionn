import { useState } from "react";
import { Badge }  from "@/components/ui/badge";
import { AlertTriangle, GripVertical, User } from "lucide-react";
import type { KanbanCard } from "../hooks/useKanbanBoard";

const PRIORITY_COLOR: Record<string, string> = {
  high:   "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low:    "bg-green-100 text-green-700 border-green-200",
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "Alta", medium: "Média", low: "Baixa",
};

interface Props {
  card:        KanbanCard;
  isDragging:  boolean;
  onDragStart: (id: string) => void;
  onDragEnd:   () => void;
}

export function KanbanCardItem({ card, isDragging, onDragStart, onDragEnd }: Props) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(card.id)}
      onDragEnd={onDragEnd}
      className={`rounded-lg border bg-background p-3 space-y-2 cursor-grab active:cursor-grabbing shadow-sm transition-all ${
        isDragging ? "opacity-40 scale-95" : "hover:shadow-md"
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
        <div className="flex items-center gap-1">
          {card.assignee_avatar ? (
            <img src={card.assignee_avatar} alt={card.assignee_name} className="h-5 w-5 rounded-full object-cover border" />
          ) : card.assignee_name ? (
            <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">
              {card.assignee_name.charAt(0).toUpperCase()}
            </div>
          ) : (
            <User className="h-3.5 w-3.5 text-muted-foreground/50" />
          )}
        </div>
      </div>
    </div>
  );
}
