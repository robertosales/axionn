// Página dedicada Retrospectiva — bypass total do Index.tsx e needsTeam
import { AppShell } from "@/components/layout/AppShell";
import { RetroManager } from "@/components/RetroManager";

export default function RetrospactivaPage() {
  return (
    <AppShell module="sala_agil">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <RetroManager />
      </div>
    </AppShell>
  );
}
