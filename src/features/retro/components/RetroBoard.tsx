import { useState } from "react";
import { Plus, Send } from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RetroCardItem } from "./RetroCard";
import { RETRO_COLUMNS } from "../hooks/useRetroSession";
import type { RetroSession, RetroColumnKey } from "../hooks/useRetroSession";

interface Props {
  session:       RetroSession;
  myUserId:      string;
  isFacilitator: boolean;
  onAddCard:     (col: RetroColumnKey, text: string) => void;
  onVote:        (id: string) => void;
  onEdit:        (id: string, text: string) => void;
  onDelete:      (id: string) => void;
}

export function RetroBoard({ session, myUserId, isFacilitator, onAddCard, onVote, onEdit, onDelete }: Props) {
  const [drafts, setDrafts] = useState<Record<RetroColumnKey, string>>({
    went_well: "", to_improve: "", action_items: "",
  });
  const [open, setOpen] = useState<Record<RetroColumnKey, boolean>>({
    went_well: false, to_improve: false, action_items: false,
  });

  const submit = (col: RetroColumnKey) => {
    if (!drafts[col].trim()) return;
    onAddCard(col, drafts[col]);
    setDrafts(d => ({ ...d, [col]: "" }));
    setOpen(o => ({ ...o, [col]: false }));
  };

  const { current_phase, cards, myVotes } = session;
  const canWrite = current_phase === "writing";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {RETRO_COLUMNS.map(col => {
        const colCards = cards
          .filter(c => c.column_key === col.key)
          .sort((a, b) =>
            current_phase === "discussing" || current_phase === "actions" || current_phase === "closed"
              ? b.votes - a.votes : 0
          );

        return (
          <div key={col.key} className={`rounded-xl border-2 ${col.color} p-4 space-y-3 min-h-[300px]`}>
            {/* Header da coluna */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                <span>{col.emoji}</span> {col.label}
                <span className="text-xs text-muted-foreground font-normal">({colCards.length})</span>
              </h3>
              {canWrite && (
                <button
                  onClick={() => setOpen(o => ({ ...o, [col.key]: !o[col.key] }))}
                  className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Input de novo card */}
            {canWrite && open[col.key] && (
              <div className="space-y-2">
                <Textarea
                  value={drafts[col.key]}
                  onChange={e => setDrafts(d => ({ ...d, [col.key]: e.target.value }))}
                  placeholder={`Escreva algo em "${col.label}"...`}
                  className="text-sm min-h-[72px] resize-none"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) submit(col.key); }}
                />
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={() => submit(col.key)}>
                    <Send className="h-3 w-3" /> Enviar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs"
                    onClick={() => { setOpen(o => ({ ...o, [col.key]: false })); setDrafts(d => ({ ...d, [col.key]: "" })); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Cards */}
            <div className="space-y-2">
              {colCards.map(card => (
                <RetroCardItem
                  key={card.id}
                  card={card}
                  phase={current_phase}
                  myUserId={myUserId}
                  hasVoted={myVotes.includes(card.id)}
                  onVote={onVote}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  isFacilitator={isFacilitator}
                />
              ))}
              {colCards.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum card ainda</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
