import { useState } from "react";
import { ThumbsUp, Trash2, Pencil, Check, X } from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge }    from "@/components/ui/badge";
import type { RetroCard as RetroCardType, RetroPhase } from "../hooks/useRetroSession";

interface Props {
  card:        RetroCardType;
  phase:       RetroPhase;
  myUserId:    string;
  hasVoted:    boolean;
  onVote:      (id: string) => void;
  onEdit:      (id: string, text: string) => void;
  onDelete:    (id: string) => void;
  isFacilitator: boolean;
}

export function RetroCardItem({ card, phase, myUserId, hasVoted, onVote, onEdit, onDelete, isFacilitator }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(card.text);

  const isMine = card.author_id === myUserId;
  const canEdit   = isMine && phase === "writing";
  const canDelete = (isMine || isFacilitator) && phase !== "closed";
  const canVote   = phase === "voting";

  const save = () => { if (draft.trim()) { onEdit(card.id, draft.trim()); setEditing(false); } };
  const cancel = () => { setDraft(card.text); setEditing(false); };

  return (
    <div className={`rounded-lg border bg-background p-3 space-y-2 shadow-sm transition-shadow hover:shadow-md ${
      hasVoted ? "ring-1 ring-primary/40" : ""
    }`}>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="text-sm min-h-[60px] resize-none"
            autoFocus
          />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-6 text-[10px] gap-1" onClick={save}><Check className="h-3 w-3" /> Salvar</Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={cancel}><X className="h-3 w-3" /> Cancelar</Button>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-relaxed">{card.text}</p>
      )}

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          {canVote && (
            <button
              onClick={() => onVote(card.id)}
              className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                hasVoted
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted hover:bg-primary/10 border-border text-muted-foreground hover:text-primary"
              }`}
            >
              <ThumbsUp className="h-3 w-3" />
              {card.votes}
            </button>
          )}
          {phase !== "writing" && phase !== "voting" && card.votes > 0 && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <ThumbsUp className="h-2.5 w-2.5" /> {card.votes}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground p-1 rounded">
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(card.id)} className="text-muted-foreground hover:text-destructive p-1 rounded">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
