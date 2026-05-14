import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminKpis } from "@/features/admin/hooks/useAdminKpis";
import { useNotifications } from "@/features/admin/hooks/useNotifications";
import { SalaAgilKpis }        from "@/features/admin/components/SalaAgilKpis";
import { SustentacaoKpis }     from "@/features/admin/components/SustentacaoKpis";
import { ModuleQuickAccess }   from "@/features/admin/components/ModuleQuickAccess";
import { ComparativeChart }    from "@/features/admin/components/ComparativeChart";
import { TeamDetailPanel }     from "@/features/admin/components/TeamDetailPanel";
import { AdminTimesPage }      from "@/features/admin/pages/AdminTimesPage";
import { AdminUsuariosPage }   from "@/features/admin/pages/AdminUsuariosPage";
import { AdminHistoricoPage }  from "@/features/admin/pages/AdminHistoricoPage";
import { AdminCapacidadePage } from "@/features/admin/pages/AdminCapacidadePage";
import { AdminFluxosPage }     from "@/features/admin/pages/AdminFluxosPage";
import { NotificationBell }    from "@/features/admin/components/NotificationBell";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, LogOut, Users, UsersRound, BarChart3, History, Gauge, GitBranch } from "lucide-react";

export default function AdminDashboard() {
  const { profile, signOut, teams } = useAuth();
  const { global: g, byTeam, loading } = useAdminKpis();
  const { notifications, criticalCount, warningCount } = useNotifications(byTeam);
  const navigate = useNavigate();
  const [selectedTeam, setSelectedTeam] = useState("all");

  const now  = new Date();
  const hora = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const data = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const sprintLabel = selectedTeam === "all"
    ? byTeam.find(t => t.sprintAtivo)?.sprintAtivo ?? null
    : byTeam.find(t => t.teamId === selectedTeam)?.sprintAtivo ?? null;

  return (
    <div className="min-h-screen bg-background">
      {/* Topbar */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <span className="font-bold text-sm">Dashboard Admin</span>
            <Badge variant="secondary" className="text-[10px] hidden sm:inline-flex">
              {teams.length} time{teams.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden md:block">{data} · {hora}</span>
            {!loading && (
              <NotificationBell
                notifications={notifications}
                criticalCount={criticalCount}
                warningCount={warningCount}
              />
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{profile?.display_name || profile?.email}</span>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
              onClick={async () => { await signOut(); navigate("/auth"); }}>
              <LogOut className="h-3.5 w-3.5" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Olá, {profile?.display_name?.split(" ")[0] ?? "Admin"} 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão consolidada de todos os módulos do Sistema AXION.</p>
        </div>

        <Tabs defaultValue="visao-geral">
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="visao-geral" className="gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" /> Visão Geral
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-1.5 text-xs">
              <History className="h-3.5 w-3.5" /> Histórico
            </TabsTrigger>
            <TabsTrigger value="capacidade" className="gap-1.5 text-xs">
              <Gauge className="h-3.5 w-3.5" /> Capacidade
            </TabsTrigger>
            <TabsTrigger value="times" className="gap-1.5 text-xs">
              <UsersRound className="h-3.5 w-3.5" /> Times
            </TabsTrigger>
            <TabsTrigger value="fluxo" className="gap-1.5 text-xs">
              <GitBranch className="h-3.5 w-3.5" /> Fluxo
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" /> Usuários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="space-y-8">
            {loading ? <Skeleton className="h-40 w-full rounded-xl" /> : <ModuleQuickAccess kpis={g} />}
            {loading ? <Skeleton className="h-32 w-full rounded-xl" /> : <SalaAgilKpis kpis={g} sprintAtivo={sprintLabel} />}
            {loading ? <Skeleton className="h-32 w-full rounded-xl" /> : <SustentacaoKpis kpis={g} />}
            {loading ? <Skeleton className="h-48 w-full rounded-xl" /> : <TeamDetailPanel byTeam={byTeam} selectedTeam={selectedTeam} onSelect={setSelectedTeam} />}
            {loading ? <Skeleton className="h-56 w-full rounded-xl" /> : <ComparativeChart byTeam={byTeam} selectedTeam={selectedTeam} />}
          </TabsContent>

          <TabsContent value="historico"><AdminHistoricoPage /></TabsContent>
          <TabsContent value="capacidade"><AdminCapacidadePage /></TabsContent>
          <TabsContent value="times"><AdminTimesPage /></TabsContent>
          <TabsContent value="fluxo"><AdminFluxosPage /></TabsContent>
          <TabsContent value="usuarios"><AdminUsuariosPage /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
