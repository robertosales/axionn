import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { Check, TrendingUp } from "lucide-react";
import type { PlanningRound, PlanningParticipant } from "../hooks/usePlanningPoker";

interface Props {
  round:          PlanningRound;
  participants:   PlanningParticipant[];
  isFacilitator:  boolean;
  onReveal:       () => void;
  onSave:         (value: string, hours: number | null) => void;
  onNewRound:     () => void;
}

export function VotesReveal({ round, participants, isFacilitator, onReveal, onSave, onNewRound }: Props) {
  const [resultValue, setResultValue] = useState(round.result_value ?? "");
  const [resultHours, setResultHours] = useState<string>(round.result_hours?.toString() ?? "");

  const revealed = round.status === "revealed" || round.status === "saved";
  const saved    = round.status === "saved";

  // Estatísticas
  const stats = useMemo(() => {
    if (!revealed || round.votes.length === 0) return null;
    const numeric = round.votes
      .map(v => parseFloat(v.vote_value))
      .filter(n => !isNaN(n));
    if (numeric.length === 0) return null;
    const avg = numeric.reduce((a, b) => a + b, 0) / numeric.length;
    const min = Math.min(...numeric);
    const max = Math.max(...numeric);
    // Moda
    const freq: Record<number, number> = {};
    numeric.forEach(n => { freq[n] = (freq[n] ?? 0) + 1; });
    const mode = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { avg: avg.toFixed(1), min, max, mode, spread: max - min };
  }, [revealed, round.votes]);

  const totalVoted = round.votes.length;
  const totalPart  = participants.length;

  return (
    <div className="space-y-4">
      {/* Progress: quem votou */}
      <div className="flex flex-wrap gap-2">
        {participants.map(p => {
          const vote = round.votes.find(v => v.user_id === p.user_id);
          return (
            <div key={p.user_id} className="flex flex-col items-center gap-1">
              <div className={`w-10 h-14 rounded-lg border-2 flex items-center justify-center text-xs font-bold transition-all ${
                vote
                  ? revealed
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "border-dashed border-muted-foreground/30 bg-muted/30 text-muted-foreground"
              }`}>
                {vote ? (revealed ? vote.vote_value : "✔") : "⋯"}
              </div>
              <span className="text-[9px] text-muted-foreground max-w-[40px] truncate text-center">{p.user_name.split(" ")[0]}</span>
            </div>
          );
        })}
      </div>

      {/* Estatísticas */}
      {revealed && stats && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Média",  value: stats.avg },
            { label: "Min",    value: stats.min },
            { label: "Max",    value: stats.max },
            { label: "Moda",   value: stats.mode },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-border bg-muted/30 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      )}
      {revealed && stats && stats.spread > 5 && (
        <div className="flex items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50/60 dark:bg-orange-950/20 px-3 py-2 text-xs text-orange-700 dark:text-orange-400">
          <TrendingUp className="h-3.5 w-3.5" />
          Alta dispersão ({stats.spread}) — considere rediscutir a HU.
        </div>
      )}

      {/* Ações do facilitador */}
      {isFacilitator && (
        <div className="flex items-end gap-2 flex-wrap">
          {!revealed ? (
            <Button size="sm" className="h-8 text-xs gap-1" onClick={onReveal} disabled={totalVoted === 0}>
              Revelar votos ({totalVoted}/{totalPart})
            </Button>
          ) : !saved ? (
            <>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Valor final</label>
                <Input value={resultValue} onChange={e => setResultValue(e.target.value)}
                  className="h-8 text-xs w-20" placeholder="ex: 5" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Horas</label>
                <Input value={resultHours} onChange={e => setResultHours(e.target.value)}
                  type="number" className="h-8 text-xs w-20" placeholder="ex: 8" />
              </div>
              <Button size="sm" className="h-8 text-xs gap-1 self-end" onClick={() => onSave(resultValue, resultHours ? parseFloat(resultHours) : null)}>
                <Check className="h-3.5 w-3.5" /> Salvar
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs self-end" onClick={onNewRound}>
                Nova rodada
              </Button>
            </>
          ) : (
            <Badge variant="default" className="gap-1"><Check className="h-3 w-3" /> Salvo: {round.result_value}{round.result_hours ? ` = ${round.result_hours}h` : ""}</Badge>
          )}
        </div>
      )}
    </div>
  );
}
