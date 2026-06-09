// ─── OkrCycleSelector ────────────────────────────────────────────────────────
// Seletor de ciclo (Q1, Q2, Q3, Q4) + filtro de time

import { cn } from "@/lib/utils";

interface Props {
  cycles:         string[];
  selectedCycle:  string;
  selectedTeam:   string;
  teams:          { id: string; name: string }[];
  onCycleChange:  (cycle: string) => void;
  onTeamChange:   (teamId: string) => void;
}

export function OkrCycleSelector({
  cycles,
  selectedCycle,
  selectedTeam,
  teams,
  onCycleChange,
  onTeamChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Seletor de ciclo tipo pill */}
      <div className="flex gap-1 bg-muted rounded-lg p-1">
        {cycles.map((c) => (
          <button
            key={c}
            onClick={() => onCycleChange(c)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
              selectedCycle === c
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Filtro de time */}
      <select
        value={selectedTeam}
        onChange={(e) => onTeamChange(e.target.value)}
        className="h-8 rounded-lg border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="all">Todos os times</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
    </div>
  );
}
