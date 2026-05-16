// src/features/kanban/hooks/useFinalizeSprint.ts
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { KanbanCard, KanbanColumn } from "./useKanbanBoard";

const DONE_COLUMN_KEYS = [
  "pronto_para_publicacao",
  "pronto para publicação",
  "done",
  "concluido",
  "concluído",
  "finalizado",
  "deployed",
  "entregue",
];

export interface SprintSummary {
  sprintId:         string;
  sprintName:       string;
  totalCards:       number;
  doneCards:        number;
  incompleteCards:  number;
  completionRate:   number;
  totalPoints:      number;
  donePoints:       number;
}

export function useFinalizeSprint(
  cards: KanbanCard[],
  columns: KanbanColumn[],
  sprints: { id: string; name: string; is_active?: boolean }[],
  onSuccess: () => void
) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);

  const activeSprint = (sprints as any[]).find((s) => s.is_active);

  const summary: SprintSummary | null = activeSprint
    ? (() => {
        const doneKeys = new Set(
          columns.filter((c) => DONE_COLUMN_KEYS.includes(c.key.toLowerCase())).map((c) => c.key)
        );
        const sprintCards = cards.filter((c) => c.sprint_id === activeSprint.id);
        const done       = sprintCards.filter((c) => doneKeys.has(c.status));
        const totalPts   = sprintCards.reduce((acc, c) => acc + (c.story_points ?? 0), 0);
        const donePts    = done.reduce((acc, c) => acc + (c.story_points ?? 0), 0);
        return {
          sprintId:        activeSprint.id,
          sprintName:      activeSprint.name,
          totalCards:      sprintCards.length,
          doneCards:       done.length,
          incompleteCards: sprintCards.length - done.length,
          completionRate:  sprintCards.length > 0 ? Math.round((done.length / sprintCards.length) * 100) : 0,
          totalPoints:     totalPts,
          donePoints:      donePts,
        };
      })()
    : null;

  const openModal  = useCallback(() => setOpen(true),  []);
  const closeModal = useCallback(() => setOpen(false), []);

  const finalize = useCallback(async (destination: "backlog" | string) => {
    if (!activeSprint) return;
    setLoading(true);
    try {
      const { error: sprintErr } = await supabase
        .from("sprints")
        .update({ is_active: false, end_date: new Date().toISOString() })
        .eq("id", activeSprint.id);
      if (sprintErr) throw sprintErr;

      const doneKeys = new Set(
        columns.filter((c) => DONE_COLUMN_KEYS.includes(c.key.toLowerCase())).map((c) => c.key)
      );
      const incompleteIds = cards
        .filter((c) => c.sprint_id === activeSprint.id && !doneKeys.has(c.status))
        .map((c) => c.id);

      if (incompleteIds.length > 0) {
        const newSprintId = destination === "backlog" ? null : destination;
        const { error: cardsErr } = await supabase
          .from("user_stories")
          .update({ sprint_id: newSprintId })
          .in("id", incompleteIds);
        if (cardsErr) throw cardsErr;
      }

      const destLabel = destination === "backlog" ? "backlog" : "próxima sprint";
      toast.success(
        `Sprint "${activeSprint.name}" finalizada! ` +
        `${incompleteIds.length > 0 ? `${incompleteIds.length} card(s) movido(s) para ${destLabel}.` : "Todos os cards foram concluídos! 🎉"}`
      );
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      console.error("[useFinalizeSprint] erro:", err);
      toast.error("Erro ao finalizar sprint: " + (err?.message ?? "tente novamente"));
    } finally {
      setLoading(false);
    }
  }, [activeSprint, cards, columns, onSuccess]);

  return { open, openModal, closeModal, summary, loading, finalize, activeSprint };
}
