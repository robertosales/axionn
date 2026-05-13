// src/features/retro/components/RetroResultsView.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Trophy, CheckCircle2, Clock, AlertCircle, BarChart2, RefreshCw, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getModel } from "../utils/retroModels";
import type { RetroSession, RetroCard, RetroActionItem } from "../types/retro";

interface Props {
  session: RetroSession;
  cards: RetroCard[];
  actionItems: RetroActionItem[];
  profiles: Record<string, string>;
  onRefresh: () => void;          // apenas recarrega os dados
  onNewSession: () => Promise<void>; // cancela atual e abre tela de início
}

export function RetroResultsView({ session, cards, actionItems, profiles, onRefresh, onNewSession }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { columns } = getModel(session.model);
  const visible  = cards.filter((c) => !c.hidden);
  const topCards = [...visible].sort((a, b) => b.votes - a.votes).slice(0, 5);

  const countByStatus = {
    pending:     actionItems.filter((a) => a.status === "pending").length,
    in_progress: actionItems.filter((a) => a.status === "in_progress").length,
    done:        actionItems.filter((a) => a.status === "done").length,
    cancelled:   actionItems.filter((a) => a.status === "cancelled").length,
  };

  const finishedDate = session.finishedAt
    ? new Date(session.finishedAt).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : null;

  const handleConfirmNew = async () => {
    setLoading(true);
    try {
      await onNewSession();
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <Card className="border-success/30 bg-success/5">
        <CardContent className="py-4 px-5 flex items-center gap-3 flex-wrap">
          <CheckCircle2 className="h-8 w-8 text-success shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Retrospectiva encerrada</p>
            <p className="text-xs text-muted-foreground">
              Modelo: <strong>{getModel(session.model).label}</strong>
              {finishedDate && <> · Encerrada em {finishedDate}</>}
            </p>
          </div>

          {/* Dois botões de ação */}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={onRefresh}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setConfirmOpen(true)}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Nova retrospectiva
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de confirmação */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar nova retrospectiva?</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe uma retrospectiva registrada para esta sprint.
              Ao continuar, a sessão atual será <strong>cancelada</strong> e você poderá
              iniciar uma nova do zero.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Manter atual</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmNew}
              disabled={loading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {loading ? "Cancelando..." : "Sim, cancelar e iniciar nova"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top cards mais votados */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-warning" /> Top cards mais votados
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {topCards.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum voto registrado.</p>
            ) : (
              topCards.map((card, i) => {
                const col = columns.find((c) => c.key === card.columnKey);
                return (
                  <div key={card.id} className="flex items-center gap-3 p-2 rounded bg-muted/40 border">
                    <span className="text-base w-6 text-center">{["🥇", "🥈", "🥉", "4", "5"][i]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs">{card.text}</p>
                      <p className="text-[10px] text-muted-foreground">{col?.icon} {col?.label}</p>
                    </div>
                    <Badge className="text-[10px]">
                      {card.votes} voto{card.votes !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Resumo action items */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
              <BarChart2 className="h-3.5 w-3.5 text-primary" /> Action Items
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { label: "Pendentes",    count: countByStatus.pending,     icon: <Clock className="h-3.5 w-3.5" />,        color: "text-muted-foreground" },
                { label: "Em andamento", count: countByStatus.in_progress,  icon: <AlertCircle className="h-3.5 w-3.5" />, color: "text-warning" },
                { label: "Concluídos",  count: countByStatus.done,         icon: <CheckCircle2 className="h-3.5 w-3.5" />,color: "text-success" },
                { label: "Cancelados",  count: countByStatus.cancelled,    icon: null,                                     color: "text-destructive" },
              ].map((s) => (
                <div key={s.label} className={cn("flex items-center gap-2 text-xs", s.color)}>
                  {s.icon}
                  <span className="font-semibold">{s.count}</span>
                  <span className="text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {actionItems.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-xs p-1.5 rounded border bg-muted/30">
                  <CheckCircle2
                    className={cn("h-3 w-3 shrink-0", item.status === "done" ? "text-success" : "text-muted-foreground")}
                  />
                  <span className={cn("flex-1 truncate", item.status === "done" && "line-through text-muted-foreground")}>
                    {item.title}
                  </span>
                  {item.ownerId && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {profiles[item.ownerId] ?? ""}
                    </span>
                  )}
                </div>
              ))}
              {actionItems.length > 6 && (
                <p className="text-[10px] text-muted-foreground text-center">+{actionItems.length - 6} itens</p>
              )}
              {actionItems.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhum action item criado.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cards por coluna */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
            Todos os cards por coluna
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className={cn(
            "grid gap-3",
            columns.length <= 3 ? "md:grid-cols-3" :
            columns.length === 4 ? "md:grid-cols-2 lg:grid-cols-4" :
            "md:grid-cols-3 lg:grid-cols-5",
          )}>
            {columns.map((col) => {
              const colCards = visible
                .filter((c) => c.columnKey === col.key)
                .sort((a, b) => b.votes - a.votes);
              return (
                <div key={col.key} className={cn("rounded-lg border-2 p-3 space-y-2", col.border, col.bg)}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{col.icon}</span>
                    <span className={cn("text-xs font-bold", col.color)}>{col.label}</span>
                    <Badge variant="outline" className="text-[10px] ml-auto">{colCards.length}</Badge>
                  </div>
                  {colCards.length === 0 && (
                    <p className="text-[11px] text-muted-foreground italic">Sem cards</p>
                  )}
                  {colCards.map((card) => (
                    <div key={card.id} className="text-xs bg-background rounded border p-2 space-y-1">
                      <p>{card.text}</p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{profiles[card.authorId] ?? "Participante"}</span>
                        {card.votes > 0 && (
                          <Badge className="text-[10px] h-4">
                            {card.votes} voto{card.votes !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
