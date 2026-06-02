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
import { NotificationBell }    from "@/features/admin/components/NotificationBell";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AxionLogo } from "@/components/AxionLogo";
import {
  LayoutDashboard, LogOut, Users, UsersRound,
  BarChart3, History, Gauge, AlertTriangle, Sparkles, Menu, X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// STYLE GUIDE — Dashboard Admin (feature/redesign-ui-admin)
// Sidebar:  bg-teal-700  w-60  fixed  h-screen  text-white
// Logo:     topo da sidebar, branco, tamanho 36px
// Nav item: px-4 py-2.5 rounded-lg hover:bg-teal-600 transition-colors
// Nav item ativo: bg-teal-600 font-semibold
// Conteudo: flex-1 overflow-auto  pl-60 (desktop)  pl-0 (mobile)
// Topbar mobile: bg-teal-700 h-14 flex items-center justify-between
// Paleta:   Teal principal #0f766e  |  hover #0d9488  |  ativo #0d9488
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { key: "visao-geral", label: "Visão Geral",  icon: BarChart3  },
  { key: "historico",   label: "Histórico",    icon: History    },
  { key: "capacidade",  label: "Capacidade",   icon: Gauge      },
  { key: "times",       label: "Times",        icon: UsersRound },
  { key: "usuarios",    label: "Usuários",     icon: Users      },
  { key: "ias",         label: "IA",           icon: Sparkles   },
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

  // Relogio atualizado a cada 30 segundos (fix #5)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const hora = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const data = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Sprint label (fix #3)
  const sprintLabel = selectedTeam === "all"
    ? (() => {
        const comSprint = byTeam.filter(t => t.sprintAtivo);
        if (comSprint.length === 0) return null;
        if (comSprint.length === 1) return comSprint[0].sprintAtivo;
        return `${comSprint.length} sprints ativas`;
      })()
    : byTeam.find(t => t.teamId === selectedTeam)?.sprintAtivo ?? null;

  const handleSignOut = async () => { await signOut(); navigate("/auth"); };

  // ── Sidebar component (inline, sem criar arquivo extra) ──────────────────
  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside
      className={[
        "bg-teal-700 text-white flex flex-col h-screen",
        mobile
          ? "w-64"
          : "fixed top-0 left-0 w-60 z-30 hidden lg:flex",
      ].join(" ")}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-teal-600">
        <AxionLogo size={36} className="brightness-0 invert" />
        <span className="text-lg font-bold tracking-tight">
          Axi<span className="text-yellow-300">o</span>n
        </span>
        {mobile && (
          <button
            className="ml-auto text-white/70 hover:text-white"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navegacao */}
      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Navegação admin">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setActivePage(key); if (mobile) setSidebarOpen(false); }}
            className={[
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
              activePage === key
                ? "bg-teal-600 text-white"
                : "text-teal-100 hover:bg-teal-600 hover:text-white",
            ].join(" ")}
            aria-current={activePage === key ? "page" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      {/* Rodape: usuario + sair */}
      <div className="px-4 py-4 border-t border-teal-600 space-y-2">
        <div className="flex items-center gap-2 text-xs text-teal-200">
          <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{profile?.display_name || "Admin"}</span>
          <Badge variant="secondary" className="ml-auto text-[9px] shrink-0">
            {teams.length} time{teams.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-teal-100 hover:bg-teal-600 hover:text-white h-8 text-xs gap-2"
          onClick={handleSignOut}
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Sair
        </Button>
      </div>
    </aside>
  );

  // ── Conteúdo da aba ativa ────────────────────────────────────────────────
  const renderContent = () => {
    switch (activePage) {
      case "historico":  return <AdminHistoricoPage />;
      case "capacidade": return <AdminCapacidadePage />;
      case "times":      return <AdminTimesPage />;
      case "usuarios":   return <AdminUsuariosPage />;
      case "ias":        return <AdminIAsPage />;
      default: return (
        <div className="space-y-8">
          {loading ? <Skeleton className="h-40 w-full rounded-xl" /> : <ModuleQuickAccess kpis={g} />}
          {loading ? <Skeleton className="h-32 w-full rounded-xl" /> : <SalaAgilKpis kpis={g} sprintAtivo={sprintLabel} />}
          {loading ? <Skeleton className="h-32 w-full rounded-xl" /> : <SustentacaoKpis kpis={g} />}

          {/* Grid de duas colunas: tabela + grafico */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div>
              {loading
                ? <Skeleton className="h-48 w-full rounded-xl" />
                : <TeamDetailPanel byTeam={byTeam} selectedTeam={selectedTeam} onSelect={setSelectedTeam} />}
            </div>
            <div>
              {loading
                ? <Skeleton className="h-56 w-full rounded-xl" />
                : <ComparativeChart byTeam={byTeam} selectedTeam={selectedTeam} />}
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar desktop */}
      <Sidebar />

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar mobile (drawer) */}
      {sidebarOpen && (
        <div className="fixed top-0 left-0 z-50 h-screen lg:hidden">
          <Sidebar mobile />
        </div>
      )}

      {/* Area principal */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-60">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
          <div className="h-14 px-4 md:px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Botao hamburger — visivel so em mobile */}
              <button
                className="lg:hidden text-muted-foreground hover:text-foreground"
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-sm font-semibold leading-tight">
                  {NAV_ITEMS.find(n => n.key === activePage)?.label ?? "Dashboard Admin"}
                </h1>
                <p className="text-[11px] text-muted-foreground hidden sm:block">{data} · {hora}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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

        {/* Conteudo */}
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
