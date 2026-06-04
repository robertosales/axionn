import { Badge }        from '@/components/ui/badge';
import { AlertTriangle, GripVertical, Zap, Wrench, Shuffle, Link2 } from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import type { KanbanCard } from '../hooks/useKanbanBoard';

const PRIORITY_COLOR: Record<string, string> = {
  high:   'bg-red-950    text-red-400    border-red-800',
  medium: 'bg-yellow-950 text-yellow-400 border-yellow-800',
  low:    'bg-green-950  text-green-400  border-green-800',
};

const PRIORITY_LABEL: Record<string, string> = {
  high: 'Alta', medium: 'Média', low: 'Baixa',
};

// Badge de modalidade do contrato vinculado (RN02)
const ROOM_MODE_CFG: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
  agil:        { icon: <Zap    className="h-2.5 w-2.5" />, className: 'bg-blue-950   text-blue-300   border-blue-800',   label: 'Ágil'       },
  sustentacao: { icon: <Wrench className="h-2.5 w-2.5" />, className: 'bg-purple-950 text-purple-300 border-purple-800', label: 'Sustentação' },
  hibrido:     { icon: <Shuffle className="h-2.5 w-2.5" />, className: 'bg-orange-950 text-orange-300 border-orange-800', label: 'Híbrido'     },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
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
    e.dataTransfer.setData('text/plain', card.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart(card.id);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    e.stopPropagation();
    onClick?.(card);
  };

  // room_mode vindo do contrato vinculado (campo opcional no KanbanCard)
  const roomMode  = (card as any).contract_room_mode as string | undefined;
  const roomCfg   = roomMode ? ROOM_MODE_CFG[roomMode] : undefined;
  const contractName = (card as any).contract_name as string | undefined;

  return (
    <TooltipProvider>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onClick={handleClick}
        className={[
          'rounded-lg border bg-background p-3 space-y-2 cursor-pointer shadow-sm transition-all',
          isDragging ? 'opacity-40 scale-95' : 'hover:shadow-md hover:border-primary/40',
          card.is_blocked ? 'border-destructive/50 bg-destructive/5' : '',
        ].join(' ')}
      >
        {/* Header: código + modalidade + grip */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-mono text-muted-foreground shrink-0">{card.code}</span>

            {/* Badge de modalidade do contrato (RN02) */}
            {roomCfg && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 gap-0.5 border ${roomCfg.className}`}
                  >
                    {roomCfg.icon}
                    {roomCfg.label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Modalidade: {roomCfg.label}
                  {contractName ? ` — ${contractName}` : ''}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {card.is_blocked && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                </TooltipTrigger>
                <TooltipContent>Card bloqueado</TooltipContent>
              </Tooltip>
            )}
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
              style={{ backgroundColor: card.epic_color ?? '#6366f1' }}
            />
            <span className="text-[10px] text-muted-foreground truncate">{card.epic_name}</span>
          </div>
        )}

        {/* Contrato vinculado */}
        {contractName && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Link2 className="h-2.5 w-2.5 shrink-0" />
            <span className="text-[10px] truncate">{contractName}</span>
          </div>
        )}

        {/* Footer: prioridade + story points + avatar */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className={`text-[9px] px-1.5 py-0 ${PRIORITY_COLOR[card.priority] ?? ''}`}
            >
              {PRIORITY_LABEL[card.priority] ?? card.priority}
            </Badge>
            {card.story_points > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                    {card.story_points}pt
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Story Points</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-1">
            {card.assignee_avatar ? (
              <img
                src={card.assignee_avatar}
                alt={card.assignee_name ?? 'Assignee'}
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
    </TooltipProvider>
  );
}
