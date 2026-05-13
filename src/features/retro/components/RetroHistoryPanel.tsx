// src/features/retro/components/RetroHistoryPanel.tsx
import { useEffect, useState } from "react";
import { retroService } from "../services/retro.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, History, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getModel } from "../utils/retroModels";
import type { RetroSession, RetroCard, RetroActionItem } from "../types/retro";

interface SessionSummary {
  session: RetroSession;
  cards: RetroCard[];
  actionItems: RetroActionItem[];
}

interface Props {
  teamId: string;
  profiles: Record<string, string>;
}

export function RetroHistoryPanel({ teamId, profiles }: Props) {
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const sessions = await retroService.listFinishedSessions(teamId);
        const details = await Promise.all(
          sessions.map(async (s) => ({
            session: s,
            cards: await retroService.listCards(s.id),
            actionItems: await retroService.listActionItems(s.id),
          }))
        );
        setSummaries(details);
      } finally {
        setLoading(false);
      }
    })();
  }, [teamId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma retrospectiva encerrada ainda.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Histórico de Retrospectivas</h3>
        <Badge variant="outline">{summaries.length}</Badge>
      </div>

      {summaries.map(({ session, cards, actionItems }) => {
        const model = getModel(session.model);
        const visible = cards.filter((c) => !c.hidden);
        const topCard = [...visible].sort((a, b) => b.votes - a.votes)[0];
        const done = actionItems.filter((a) => a.status === "done").length;
        const expanded = expandedId === session.id;
        const date = session.finishedAt
          ? new Date(session.finishedAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "";

        return (
          <Card key={session.id} className="overflow-hidden">
            <button
              className="w-full text-left"
              onClick={() => setExpandedId(expanded ? null : session.id)}
            >
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-sm font-semibold">{model.label}</CardTitle>
                    <Badge variant="outline" className="text-[10px]">{date}</Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {visible.length} card{visible.length !== 1 ? "s" : ""}
                    </Badge>
                    <Badge
                      className={cn(
                        "text-[10px]",
                        done === actionItems.length && actionItems.length > 0 ? "bg-success" : "",
                      )}
                    >
                      {done}/{actionItems.length} ações
                    </Badge>
                  </div>
                  {expanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                {topCard && (
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">
                    🏆 Mais votado: "{topCard.text.slice(0, 60)}{topCard.text.length > 60 ? "..." : ""}"
                  </p>
                )}
              </CardHeader>
            </button>

            {expanded && (
              <CardContent className="px-4 pb-4 border-t pt-3 space-y-3">
                {/* Cards por coluna resumido */}
                <div className="flex flex-wrap gap-2">
                  {model.columns.map((col) => {
                    const count = visible.filter((c) => c.columnKey === col.key).length;
                    return (
                      <div
                        key={col.key}
                        className={cn(
                          "text-[11px] flex items-center gap-1 px-2 py-1 rounded border",
                          col.bg,
                          col.border,
                        )}
                      >
                        <span>{col.icon}</span>
                        <span className={col.color}>{col.label}</span>
                        <Badge variant="outline" className="text-[10px] ml-1">{count}</Badge>
                      </div>
                    );
                  })}
                </div>

                {/* Action items */}
                {actionItems.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase">Action Items</p>
                    {actionItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-xs">
                        <CheckCircle2
                          className={cn(
                            "h-3 w-3 shrink-0",
                            item.status === "done" ? "text-success" : "text-muted-foreground",
                          )}
                        />
                        <span
                          className={cn(
                            "flex-1 truncate",
                            item.status === "done" && "line-through text-muted-foreground",
                          )}
                        >
                          {item.title}
                        </span>
                        {item.ownerId && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {profiles[item.ownerId] ?? ""}
                          </span>
                        )}
                        {item.dueDate && (
                          <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(item.dueDate + "T00:00:00").toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
