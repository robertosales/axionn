// Página dedicada Retrospectiva — bypass total do Index.tsx e needsTeam
import { AppShell } from "@/components/layout/AppShell";
import { RetroManager } from "@/components/RetroManager";
import { useNavigate } from "react-router-dom";

export default function RetrospactivaPage() {
  const navigate = useNavigate();
  const handleNavigate = (key: string) => navigate(`/sala-agil/${key}`);
  return (
    <AppShell module="sala_agil" activeKey="retrospectiva" onNavigate={handleNavigate}>
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <RetroManager />
      </div>
    </AppShell>
  );
}
