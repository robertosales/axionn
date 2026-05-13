import { DECKS } from "../hooks/usePlanningPoker";
import type { DeckMode } from "../hooks/usePlanningPoker";

interface Props {
  deckMode: DeckMode;
  myVote:   string | null;
  onVote:   (value: string) => void;
  disabled: boolean;
}

export function PokerDeck({ deckMode, myVote, onVote, disabled }: Props) {
  const values = DECKS[deckMode]?.values ?? DECKS.fibonacci.values;

  return (
    <div className="flex flex-wrap justify-center gap-2 py-2">
      {values.map(v => {
        const selected = myVote === v;
        return (
          <button
            key={v}
            disabled={disabled}
            onClick={() => onVote(v)}
            className={`
              relative flex flex-col items-center justify-center
              w-14 h-20 rounded-xl border-2 text-sm font-bold
              transition-all duration-150 select-none
              ${
                selected
                  ? "border-primary bg-primary text-primary-foreground shadow-lg scale-110 -translate-y-1"
                  : disabled
                  ? "border-muted bg-muted/30 text-muted-foreground cursor-not-allowed"
                  : "border-border bg-card hover:border-primary/60 hover:bg-primary/5 hover:scale-105 hover:-translate-y-0.5 cursor-pointer shadow-sm"
              }
            `}
          >
            <span className="text-[9px] absolute top-1.5 left-2 opacity-50">{v}</span>
            <span className="text-xl">{v === "?" ? "🤷" : v === "☕" ? "☕" : v}</span>
            <span className="text-[9px] absolute bottom-1.5 right-2 opacity-50">{v}</span>
          </button>
        );
      })}
    </div>
  );
}
