import { Badge }  from "@/components/ui/badge";
import { CheckCircle, Clock, ThumbsUp, Zap } from "lucide-react";
import type { RetroHistoryItem } from "../hooks/useRetroSession";

interface Props { history: RetroHistoryItem[]; }

export function RetroHistory({ history }: Props) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma retrospectiva realizada ainda.</p>;
  }

  return (
    <div className="space-y-3">
      {history.map(h => (
        <div key={h.id} className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{h.sprint_name}</span>
              <Badge variant={h.status === "open" ? "default" : "secondary"} className="text-[10px]">
                {h.status === "open" ? "Em andamento" : "Encerrada"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(h.created_at).toLocaleDateString("pt-BR")}
              {h.finished_at && ` — ${new Date(h.finished_at).toLocaleDateString("pt-BR")}`}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>{h.wentWell} bem</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-orange-500">
              <Clock className="h-3.5 w-3.5" />
              <span>{h.toImprove} melhorias</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-blue-500">
              <Zap className="h-3.5 w-3.5" />
              <span>{h.actionCount} ações</span>
            </div>
            <Badge variant="outline" className="text-[10px]">{h.cardCount} cards</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
