// src/features/retro/components/RetroPhaseHeader.tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronRight, Crown, Users, AlertTriangle, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RETRO_PHASE_LABELS } from "../utils/retroModels";
import type { RetroPhase, RetroParticipant, RetroSession } from "../types/retro";

interface Props {
  session: RetroSession;
  participants: RetroParticipant[];
  profiles: Record<string, string>;
  isFacilitator: boolean;
  facilitatorOffline: boolean;
  modelLabel: string;
  onAdvance: () => void;
  onClose: () => void;
  onCancel: () => void;
  onAssumeFacilitator: () => void;
  onTransfer: (userId: string) => void;
  nextPhaseLabel: string | null;
}

const initials = (name: string) => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export function RetroPhaseHeader({
  session,
  participants,
  profiles,
  isFacilitator,
  facilitatorOffline,
  modelLabel,
  onAdvance,
  onClose,
  onCancel,
  onAssumeFacilitator,
  onTransfer,
  nextPhaseLabel,
}: Props) {
  const facilitator = participants.find((p) => p.isFacilitator);
  const onlineCount = participants.filter((p) => p.isOnline).length;

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
        {/* esquerda: fase + modelo */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge className="gap-1 px-3 py-1 text-xs">
            {RETRO_PHASE_LABELS[session.currentPhase]}
          </Badge>
          <span className="text-xs text-muted-foreground">Modelo: {modelLabel}</span>
        </div>

        {/* meio: facilitador + participantes */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs">
            <Crown className="h-3.5 w-3.5 text-warning" />
            <span className="text-muted-foreground">Facilitador:</span>
            <span className="font-semibold">
              {facilitator ? profiles[facilitator.userId] ?? "—" : "—"}
            </span>
            {facilitatorOffline && !isFacilitator && (
              <Button size="sm" variant="outline" className="h-6 text-[10px] ml-2" onClick={onAssumeFacilitator}>
                <AlertTriangle className="h-3 w-3 mr-1 text-warning" /> Assumir
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{onlineCount} online</span>
          </div>

          <div className="flex -space-x-2">
            {participants.slice(0, 6).map((p) => (
              <Avatar key={p.id} className={`h-7 w-7 border-2 ${p.isOnline ? "border-success" : "border-muted"}`}>
                <AvatarFallback className="text-[10px]">{initials(profiles[p.userId] ?? "U")}</AvatarFallback>
              </Avatar>
            ))}
          </div>
        </div>

        {/* direita: ações */}
        {isFacilitator && (
          <div className="flex items-center gap-2">
            {session.currentPhase !== "voting" && session.currentPhase !== "closed" && nextPhaseLabel && (
              <Button size="sm" onClick={onAdvance} className="gap-1">
                Avançar para {nextPhaseLabel}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {session.currentPhase === "voting" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="default" className="gap-1">
                    Encerrar sessão
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Encerrar retrospectiva?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A sessão será finalizada e os resultados serão arquivados no Histórico Ágil. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={onClose}>Confirmar encerramento</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 px-2">
                  <Crown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Transferir facilitação</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {participants
                  .filter((p) => !p.isFacilitator)
                  .map((p) => (
                    <DropdownMenuItem key={p.id} onClick={() => onTransfer(p.userId)}>
                      {profiles[p.userId] ?? "Usuário"}
                    </DropdownMenuItem>
                  ))}
                {participants.filter((p) => !p.isFacilitator).length === 0 && (
                  <DropdownMenuItem disabled>Sem outros participantes</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive">
                  <X className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar sessão?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A sessão atual será descartada. Você poderá iniciar uma nova depois.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={onCancel}>Cancelar sessão</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
