import { useState, useEffect } from "react";
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
import { AdminIAsPage }        from "@/features/admin/pages/AdminIAsPage";
import { ContractsDashboard }  from "@/features/contracts/components/ContractsDashboard";
import { NotificationBell }    from "@/features/admin/components/NotificationBell";
import { ThemeToggle }         from "@/components/ThemeToggle";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AxionLogo } from "@/components/AxionLogo";
import {
  LogOut, Users, UsersRound,
  BarChart3, History, Gauge, AlertTriangle, Sparkles, Menu, X, FileText,
} from "lucide-react";

const TEAL = "#0bbcaf";

const NAV_ITEMS = [
  { key: "visao-geral", label: "Vis\u00e3o Geral", icon: BarChart3  },
  { key: "historico",   label: "Hist\u00f3rico",   icon: History    },
  { key: "capacidade",  label: "Capacidade",  icon: Gauge      },
  { key: "times",       label: "Times",       icon: UsersRound },
  { key: "usuarios",    label: "Usu\u00e1rios",    icon: Users      },
  { key: "ias",         label: "IA",          icon: Sparkles   },
  { key: "contratos",   label: "Contratos",   icon: FileText   },
] as const;

type PageKey = typeof NAV_ITEMS[number]["key"];

export default function AdminDashboard() {
  const { profile, signOut, teams } = useAuth();
  const { global: g, byTeam, loading, dataWarnings } = useAdminKpis();
  const { notifications, criticalCount, warningCount } = useNotifications(byTeam);
  const navigate = useNavigate();
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [activePage, setActivePage]     = useState<PageKey>("visao-geral");
  const [sidebarOpen, setSidebarOpen]   = useState(false);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const hora = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const data = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const sprintLabel = selectedTeam === "all"
    ? (() => {
        const comSprint = byTeam.filter(t => t.sprintAtivo);
        if (comSprint.length === 0) return null;
        if (comSprint.length === 1) return comSprint[0].sprintAtivo;
        return `${comSprint.length} sprints ativas`;
      })()
    : byTeam.find(t => t.teamId === selectedTeam)?.sprintAtivo ?? null;

  const handleSignOut = async () => { await signOut(); navigate("/auth"); };

  // ── Sidebar ──────────────────────────────────────────────────────────────────
  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside
      className={[
        "flex flex-col h-screen transition-colors duration-250 scrollbar-none",
        mobile ? "w-64" : "fixed top-0 left-0 w-60 z-30 hidden lg:flex",
      ].join(" ")}
      style={{ background: "hsl(var(--sidebar))", color: "hsl(var(--sidebar-foreground))" }}
    >
      <div
        className="flex items-center gap-2.5 px-4 h-14 shrink-0"
        style={{ borderBottom: "1px solid rgba(192,212,208,0.08)" }}
      >
        <AxionLogo size={24} />
        <div className="min-w-0">
          <p className="text-[15px] font-bold leading-none tracking-tight" style={{ color: "#ffffff" }}>
            Axion
          </p>
          <p className="text-[9px] uppercase tracking-widest leading-none mt-0.5" style={{ color: TEAL }}>
            Admin
          </p>
        </div>
        {mobile && (
          <button
            className="ml-auto flex items-center justify-center"
            style={{ color: "rgba(192,212,208,0.5)" }}
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav
        className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-none"
        aria-label="Navegação admin"
        style={{ scrollbarWidth: "none" }}
      >
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const isActive = activePage === key;
          return (
            <button
              key={key}
              onClick={() => { setActivePage(key); if (mobile) setSidebarOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors text-left relative"
              style={{
                background: isActive ? "hsl(var(--sidebar-active))" : "transparent",
                color:      isActive ? "#ffffff" : "rgba(192,212,208,0.7)",
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "hsl(var(--sidebar-accent))";
                  (e.currentTarget as HTMLElement).style.color = "hsl(var(--sidebar-foreground))";
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "rgba(192,212,208,0.7)";
                }
              }}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                  style={{ background: TEAL }}
                />
              )}
              <Icon
                className="h-[14px] w-[14px] shrink-0"
                style={{ color: isActive ? TEAL : "rgba(61,90,86,1)" }}
                aria-hidden="true"
              />
              {label}
              {/* Badge "Novo" no item Contratos */}
              {key === "contratos" && (
                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300">
                  Novo
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div
        className="px-3 py-3 space-y-2 shrink-0"
        style={{ borderTop: "1px solid rgba(192,212,208,0.08)" }}
      >
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "rgba(192,212,208,0.55)" }}>
          <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{profile?.display_name || "Admin"}</span>
          <Badge
            variant="secondary"
            className="ml-auto text-[9px] shrink-0 border-transparent"
            style={{ background: "hsl(var(--sidebar-accent))", color: "rgba(192,212,208,0.8)" }}
          >
            {teams.length} time{teams.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start h-8 text-xs gap-2 transition-colors"
          style={{ color: "rgba(192,212,208,0.6)" }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "hsl(var(--sidebar-accent))";
            (e.currentTarget as HTMLElement).style.color = "hsl(var(--sidebar-foreground))";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "rgba(192,212,208,0.6)";
          }}
          onClick={handleSignOut}
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Sair
        </Button>
      </div>
    </aside>
  );

  // ── Conteúdo da aba ativa ─────────────────────────────────────────────────
  const renderContent = () => {
    switch (activePage) {
      case "historico":  return <AdminHistoricoPage />;
      case "capacidade": return <AdminCapacidadePage />;
      case "times":      return <AdminTimesPage />;
      case "usuarios":   return <AdminUsuariosPage />;
      case "ias":        return <AdminIAsPage />;
      case "contratos":  return <ContractsDashboard />;
      default: return (
        <div className="space-y-8">
          {loading ? <Skeleton className="h-40 w-full rounded-xl" /> : <ModuleQuickAccess kpis={g} />}
          {loading ? <Skeleton className="h-32 w-full rounded-xl" /> : <SalaAgilKpis kpis={g} sprintAtivo={sprintLabel} />}
          {loading ? <Skeleton className="h-32 w-full rounded-xl" /> : <SustentacaoKpis kpis={g} />}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div>
              {loading ? <Skeleton className="h-48 w-full rounded-xl" /> : <TeamDetailPanel byTeam={byTeam} selectedTeam={selectedTeam} onSelect={setSelectedTeam} />}
            </div>
            <div>
              {loading ? <Skeleton className="h-56 w-full rounded-xl" /> : <ComparativeChart byTeam={byTeam} selectedTeam={selectedTeam} />}
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "hsl(var(--background))" }}>
      <Sidebar />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {sidebarOpen && (
        <div className="fixed top-0 left-0 z-50 h-screen lg:hidden">
          <Sidebar mobile />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 lg:pl-60">
        <header
          className="sticky top-0 z-20 backdrop-blur"
          style={{ background: "hsl(var(--background) / 0.95)", borderBottom: "1px solid hsl(var(--border))" }}
        >
          <div className="h-14 px-4 md:px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden"
                style={{ color: "hsl(var(--muted-foreground))" }}
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-sm font-semibold leading-tight">
                  {NAV_ITEMS.find(n => n.key === activePage)?.label ?? "Dashboard Admin"}
                </h1>
                <p className="text-[11px] hidden sm:block" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {data} · {hora}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              {!loading && (
                <NotificationBell
                  notifications={notifications}
                  criticalCount={criticalCount}
                  warningCount={warningCount}
                />
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-6 py-6">
          {dataWarnings.length > 0 && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Atenção:</strong> Alguns KPIs podem estar incompletos por volume excessivo de dados:
                <ul className="mt-1 list-disc pl-4">
                  {dataWarnings.map((w, i) => <li key={i} className="text-xs">{w}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
