// Página dedicada Planning Poker — bypass total do Index.tsx e needsTeam
import { AppShell } from "@/components/layout/AppShell";
import { PlanningPoker } from "@/components/PlanningPoker";
import { useNavigate } from "react-router-dom";

export default function PlanningPokerPage() {
  const navigate = useNavigate();
  const handleNavigate = (key: string) => navigate(`/sala-agil/${key}`);
  return (
    <AppShell module="sala_agil" activeKey="planning-poker" onNavigate={handleNavigate}>
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <PlanningPoker />
      </div>
    </AppShell>
  );
}
