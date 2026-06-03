import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MoreHorizontal, User, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Demanda } from "../types/demanda";
import { getResponsavelAtivo } from "../types/demanda";
import { getTipoLabel } from "../types/imr";
import { getInitials, formatPersonName } from "@/lib/personName";
import { SLABadge } from "./SLABadge";

interface Props {
  demanda: Demanda;
  onOpen: (d: Demanda) => void;
  onDelete?: (d: Demanda) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, d: Demanda) => void;
  moveOptions?: { key: string; label: string }[];
  onMove?: (d: Demanda, targetKey: string) => void;
}

export function DemandaCard({
  demanda,
  onOpen,
  onDelete,
  draggable,
  onDragStart,
  moveOptions,
  onMove,
}: Props) {
  const responsavel = getResponsavelAtivo(demanda);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card
          className="p-3 cursor-pointer hover:shadow-md transition-shadow group border border-border/60 flex flex-col gap-2"
          draggable={draggable}
          onDragStart={(e) => onDragStart?.(e, demanda)}
          onClick={() => onOpen(demanda)}
        >
          {/* LINHA 1: RHM + SLA badge dinâmico + menu */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="text-xs font-mono font-bold text-info shrink-0">{demanda.rhm}</span>

              {/* Badge SLA dinâmico */}
              <SLABadge
                demandaId={demanda.id}
                contractId={(demanda as any).contract_id ?? null}
                priority={(demanda as any).sla_priority ?? null}
                createdAt={demanda.created_at ?? demanda.data_abertura}
                slaLegado={demanda.sla}
              />

              {demanda.situacao === "bloqueada" && (
                <Badge className="text-[10px] h-4 px-1 bg-destructive/10 text-destructive border-destructive/20 shrink-0">
                  Bloqueada
                </Badge>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0 -mr-1">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpen(demanda); }}>
                  Detalhes
                </DropdownMenuItem>
                {onDelete && (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => { e.stopPropagation(); onDelete(demanda); }}
                  >
                    Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* LINHA 2: Título + projeto */}
          <div className="space-y-0.5 min-w-0">
            {demanda.descricao && (
              <p className="text-xs font-semibold leading-snug line-clamp-2 text-foreground">{demanda.descricao}</p>
            )}
            <p className="text-[10px] text-muted-foreground truncate">{demanda.projeto}</p>
          </div>

          {/* LINHA 3: tipo + responsável */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">
              {getTipoLabel(demanda.tipo)}
            </Badge>

            {responsavel ? (
              <div className="flex items-center gap-1 min-w-0">
                <div
                  className="h-4 w-4 rounded-full bg-info/15 text-info text-[8px] font-bold flex items-center justify-center shrink-0"
                  title={responsavel}
                >
                  {getInitials(responsavel)}
                </div>
                <span className="text-[10px] text-muted-foreground truncate max-w-[110px]">{formatPersonName(responsavel)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-muted-foreground/40">
                <User className="h-3 w-3" />
                <span className="text-[10px]">Sem responsável</span>
              </div>
            )}
          </div>
        </Card>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={() => onOpen(demanda)}>Abrir detalhes</ContextMenuItem>
        {moveOptions && onMove && moveOptions.length > 0 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <ArrowRightLeft className="h-3.5 w-3.5 mr-2" />
              Mover para
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="max-h-[60vh] overflow-y-auto">
              {moveOptions.map((opt) => (
                <ContextMenuItem
                  key={opt.key}
                  disabled={opt.key === demanda.situacao}
                  onClick={() => onMove(demanda, opt.key)}
                >
                  {opt.label}
                  {opt.key === demanda.situacao && (
                    <span className="ml-auto text-[10px] text-muted-foreground">(atual)</span>
                  )}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        {onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem className="text-destructive" onClick={() => onDelete(demanda)}>
              Excluir
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
