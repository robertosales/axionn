// ─── OkrPage ─────────────────────────────────────────────────────────────────
// Página principal do módulo OKR
// Para ativar: adicionar rota /okr no App.tsx e item no menu lateral
//
// App.tsx:
//   const OkrPage = lazy(() => import("./features/okr/OkrPage").then(m => ({ default: m.OkrPage })));
//   <Route path="/okr" element={<ProtectedRoute><OkrPage /></ProtectedRoute>} />

import { Target, Plus } from "lucide-react";
import { Button }       from "@/components/ui/button";
import { useOkr }       from "./hooks/useOkr";
import { OkrCycleSelector } from "./components/OkrCycleSelector";
import { OkrSummaryKpis }   from "./components/OkrSummaryKpis";
import { OkrObjectiveCard }  from "./components/OkrObjectiveCard";

// Times mockados — na integração real viriam do AuthContext / Supabase
const MOCK_TEAMS = [
  { id: "t1", name: "NEXO - TIME A" },
  { id: "t2", name: "TIME B" },
];

export function OkrPage() {
  const { objectives, cycles, filters, setFilters, isLoading, addCheckIn } = useOkr();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">OKR</h1>
            <p className="text-sm text-muted-foreground">
              Objetivos e Key Results · {filters.cycle}
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 h-9">
          <Plus className="h-4 w-4" /> Novo Objetivo
        </Button>
      </div>

      {/* ── Filtros: Ciclo + Time ── */}
      <OkrCycleSelector
        cycles={cycles}
        selectedCycle={filters.cycle}
        selectedTeam={filters.teamId}
        teams={MOCK_TEAMS}
        onCycleChange={(cycle)  => setFilters({ cycle })}
        onTeamChange={(teamId)  => setFilters({ teamId })}
      />

      {/* ── KPIs ── */}
      <OkrSummaryKpis objectives={objectives} />

      {/* ── Cards dos Objetivos ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : objectives.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            Nenhum objetivo encontrado para este ciclo e time.
          </p>
          <Button size="sm" variant="outline" className="mt-4 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Criar primeiro objetivo
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {objectives.map((obj) => (
            <OkrObjectiveCard
              key={obj.id}
              objective={obj}
              onCheckIn={addCheckIn}
            />
          ))}
        </div>
      )}
    </div>
  );
}
