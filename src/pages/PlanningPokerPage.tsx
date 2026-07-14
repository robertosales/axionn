// Página dedicada Planning Poker — bypass total do Index.tsx e needsTeam
import { AppShell } from "@/components/layout/AppShell";
import { PlanningPoker } from "@/components/PlanningPoker";

export default function PlanningPokerPage() {
  return (
    <AppShell module="sala_agil">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <PlanningPoker />
      </div>
    </AppShell>
  );
}
