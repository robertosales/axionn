import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminKpis } from "@/features/admin/hooks/useAdminKpis";
import { useNotifications } from "@/features/admin/hooks/useNotifications";
import { useDashboardFilters } from "@/features/admin/hooks/useDashboardFilters";
import { ContractProvider, useContractContext } from "@/features/admin/contexts/ContractContext";
import { ContractSwitcher } from "@/features/admin/components/ContractSwitcher";
import { SalaAgilKpis } from "@/features/admin/components/SalaAgilKpis";
import { SustentacaoKpis } from "@/features/admin/components/SustentacaoKpis";
import { ModuleQuickAccess } from "@/features/admin/components/ModuleQuickAccess";
import { AdminTimesPage } from "@/features/admin/pages/AdminTimesPage";
import { AdminUsuariosPage } from "@/features/admin/pages/AdminUsuariosPage";
import { AdminHistoricoPage } from "@/features/admin/pages/AdminHistoricoPage";
import { AdminCapacidadePage } from "@/features/admin/pages/AdminCapacidadePage";
import { AdminIAsPage } from "@/features/admin/pages/AdminIAsPage";
import { AdminContratosPage } from "@/features/admin/pages/AdminContratosPage";
import { AdminEmpresasPage } from "@/features/admin/pages/AdminEmpresasPage";
import { ProjetosAdminPanel } from "@/features/admin/components/ProjetosAdminPanel";
import { NotificationBell } from "@/features/admin/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DashboardFilters } from "@/features/admin/components/DashboardFilters";
import { ExecutiveKpis } from "@/features/admin/components/ExecutiveKpis";
import { TeamSummaryCards } from "@/features/admin/components/TeamSummaryCards";
import { TeamDetailDrawer } from "@/features/admin/components/TeamDetailDrawer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AxionLogo } from "@/components/AxionLogo";
import type { TeamKpis, AdminKpis } from "@/features/admin/hooks/useAdminKpis";
import {
  LogOut,
  Users,
  UsersRound,
  BarChart3,
  History,
  Gauge,
  AlertTriangle,
  Sparkles,
  Menu,
  X,
  FileText,
  FolderKanban,
  RefreshCw,
  Building2,
} from "lucide-react";

const NAV_ITEMS = [
  { key: "visao-geral", label: "Visão Geral",  icon: BarChart3  },
  { key: "historico",   label: "Histórico",    icon: History    },
  { key: "capacidade",  label: "Capacidade",   icon: Gauge      },
  { key: "times",       label: "Times",        icon: UsersRound },
  { key: "usuarios",    label: "Usuários",     icon: Users      },
  { key: "projetos",    label: "Projetos",     icon: FolderKanban },
  { key: "ias",         label: "IA",           icon: Sparkles   },
  { key: "contratos",   label: "Contratos",    icon: FileText   },
  { key: "empresas",    label: "Empresas",     icon: Building2  },
] as const;

type PageKey = (typeof NAV_ITEMS)[number]["key"];

function useTopBarBg() {
  const [bg, setBg] = useState<string>("#ffffff");

  useEffect(() => {
    const update = () => {
      const theme = document.documentElement.getAttribute("data-theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const isDark = theme === "dark" || (!theme && prefersDark);
      const rawBg = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
      if (rawBg) {
        setBg(`hsl(${rawBg})`);
      } else {
        setBg(isDark ? "#171614" : "#f7f6f2");
      }
    };
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    return () => {
      obs.disconnect();
      mq.removeEventListener("change", update);
    };
  }, []);

  return bg;
}

interface VisaoGeralPageProps {
  byTeam: TeamKpis[];
  loading: boolean;
  dataWarnings: string[] | null | undefined;
  globalKpis: AdminKpis["global"];
  onViewTeamDetails: (id: string) => void;
}

function VisaoGeralPage({
  byTeam,
  loading,
  dataWarnings,
  globalKpis,
  onViewTeamDetails,
}: VisaoGeralPageProps) {
  const { pendingFilters, appliedTeamId, appliedModule, handleChange, handleApply } =
    useDashboardFilters();

  const filteredByTeam = useMemo(() => {
    if (appliedTeamId === "all") return byTeam;
    return byTeam.filter((t) => t.teamId === appliedTeamId);
  }, [byTeam, appliedTeamId]);

  const filteredByModule = useMemo(() => {
    if (appliedModule === "todos") return filteredByTeam;
    return filteredByTeam.filter((t) => {
      const m = (t.module ?? "").toLowerCase();
      if (appliedModule === "sala-agil") return m.includes("agil") || m.includes("scrum");
      if (appliedModule === "sustentacao") return m.includes("sust");
      if (appliedModule === "rdm") return m.includes("rdm") || m.includes("muda");
      return true;
    });
  }, [filteredByTeam, appliedModule]);

  const execKpis = useMemo(() => {
    const timesAtivos = filteredByModule.length;
    const sprintSet = new Set(
      filteredByModule.map((t) => t.sprintAtivo).filter(Boolean),
    );
    const sprintLabel =
      sprintSet.size === 1
        ? [...sprintSet][0]!
        : sprintSet.size > 1
          ? `${sprintSet.size} sprints ativas`
          : null;
    const husAtivas = filteredByModule.reduce(
      (s, t) => s + Math.max(0, (t.totalHUs ?? 0) - (t.husConcluidasNoSprint ?? 0)),
      0,
    );
    const husTotais = filteredByModule.reduce((s, t) => s + (t.totalHUs ?? 0), 0);
    const husConcluidas = filteredByModule.reduce(
      (s, t) => s + (t.husConcluidasNoSprint ?? 0),
      0,
    );
    const husConcluidasPct =
      husTotais > 0 ? Math.round((husConcluidas / husTotais) * 100) : 0;
    const demandasAbertas = filteredByModule.reduce(
      (s, t) => s + (t.demandasAbertas ?? 0),
      0,
    );
    const slaEmRisco = filteredByModule.reduce((s, t) => s + (t.slaEmRisco ?? 0), 0);
    return {
      timesAtivos,
      sprintLabel,
      husAtivas,
      husConcluidasPct,
      demandasAbertas,
      slaEmRisco,
    };
  }, [filteredByModule]);

  const teamCards = useMemo(
    () =>
      filteredByModule.map((t) => ({
        teamId: t.teamId,
        teamName: t.teamName,
        module: (t.module ?? "").toLowerCase().includes("agil")
          ? "sala-agil"
          : "sustentacao",
        husAtivas: Math.max(
          0,
          (t.totalHUs ?? 0) - (t.husConcluidasNoSprint ?? 0),
        ),
        impedimentos: t.impedimentosAbertos,
        backlog: t.backlogTotal,
        demandasAbertas: t.demandasAbertas,
        slaEmRisco: t.slaEmRisco,
        bloqueadas: t.demandasBloqueadas,
        sprintAtivo: t.sprintAtivo,
      })),
    [filteredByModule],
  );

  const teamsForFilter = useMemo(
    () => byTeam.map((t) => ({ id: t.teamId, name: t.teamName })),
    [byTeam],
  );

  return (
    <div className="flex flex-col gap-5">
      {dataWarnings && dataWarnings.length > 0 && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          <AlertDescription className="text-xs">
            {dataWarnings[0]}
          </AlertDescription>
        </Alert>
      )}

      {/* 1. FILTROS */}
      <DashboardFilters
        filters={pendingFilters}
        teams={teamsForFilter}
        onChange={handleChange}
        onApply={handleApply}
        loading={loading}
      />

      {/* 2. ACESSO RÁPIDO */}
      <section aria-label="Acesso rápido">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Acesso Rápido
        </h2>
        <ModuleQuickAccess kpis={globalKpis} />
      </section>

      {/* 3. CARDS EXECUTIVOS */}
      <section aria-label="Indicadores executivos">
        <ExecutiveKpis
          timesAtivos={execKpis.timesAtivos}
          sprintAtiva={execKpis.sprintLabel}
          husAtivas={execKpis.husAtivas}
          husConcluidasPct={execKpis.husConcluidasPct}
          demandasAbertas={execKpis.demandasAbertas}
          slaEmRisco={execKpis.slaEmRisco}
          slaDescricao={
            execKpis.slaEmRisco > 0 ? "+5 dias sem conclusão" : undefined
          }
          loading={loading}
        />
      </section>

      {/* 4. RESUMO POR TIME */}
      <section aria-label="Resumo por time">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Resumo por Time
        </h2>
        <TeamSummaryCards
          teams={teamCards}
          loading={loading}
          onTeamClick={onViewTeamDetails}
        />
      </section>

      {/* 5. INDICADORES POR MÓDULO */}
      {(appliedModule === "todos" || appliedModule === "sala-agil") && (
        <section aria-label="Indicadores Sala Ágil">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-4">
            Indicadores por Módulo
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-xl border bg-card shadow-sm p-4">
              <SalaAgilKpis
                kpis={globalKpis}
                sprintAtivo={execKpis.sprintLabel}
              />
            </div>
            {appliedModule === "todos" && (
              <div className="rounded-xl border bg-card shadow-sm p-4">
                <SustentacaoKpis kpis={globalKpis} />
              </div>
            )}
          </div>
        </section>
      )}

      {appliedModule === "sustentacao" && (
        <section aria-label="Indicadores Sustentação">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-4">
            Indicadores por Módulo
          </h2>
          <div className="rounded-xl border bg-card shadow-sm p-4">
            <SustentacaoKpis kpis={globalKpis} />
          </div>
        </section>
      )}
    </div>
  );
}

function AdminDashboardInner() {
  const { profile, signOut } = useAuth();
  const { isGestor, selectedContractId, selectedContract } = useContractContext();
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState<PageKey>("visao-geral");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailTeamId, setDetailTeamId] = useState<string | null>(null);

  const { global: g, byTeam, loading, dataWarnings } = useAdminKpis(selectedContractId);
  const { notifications, criticalCount, warningCount } = useNotifications(
    byTeam ?? [],
  );

  const topBarBg = useTopBarBg();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const horaLabel = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dataLabel = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  useEffect(() => {
    if (!loading) setLastUpdated(new Date());
  }, [loading]);
  const lastUpdatedLabel = useMemo(() => {
    const diffMin = Math.floor(
      (Date.now() - lastUpdated.getTime()) / 60_000,
    );
    if (diffMin < 1) return "agora mesmo";
    if (diffMin === 1) return "há 1 minuto";
    return `há ${diffMin} minutos`;
  }, [lastUpdated]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const isVisaoGeral = activePage === "visao-geral";
  const activeLabel =
    NAV_ITEMS.find((n) => n.key === activePage)?.label ?? "";

  const userInitials =
    profile?.full_name
      ?.split(" ")
      .slice(0, 2)
      .map((n: string) => n[0])
      .join("") || "?";

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside
      className={[
        "flex flex-col h-screen transition-colors duration-250 scrollbar-none",
        mobile ? "w-64" : "fixed top-0 left-0 w-60 z-30 hidden lg:flex",
      ].join(" ")}
      style={{
        background: "hsl(var(--sidebar))",
        color: "hsl(var(--sidebar-foreground))",
      }}
    >
      <div
        className="flex items-center gap-2.5 px-4 h-14 shrink-0"
        style={{ borderBottom: "1px solid rgba(192,212,208,0.08)" }}
      >
        <AxionLogo size={24} />
        <div className="min-w-0">
          <p
            className="text-[15px] font-bold leading-none tracking-tight"
            style={{ color: "#ffffff" }}
          >
            Axion
          </p>
          <p className="text-[9px] uppercase tracking-widest leading-none mt-0.5 text-primary">
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

      {isGestor && <ContractSwitcher />}

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
              onClick={() => {
                setActivePage(key);
                if (mobile) setSidebarOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors text-left"
              style={{
                background: isActive
                  ? "hsl(var(--sidebar-active))"
                  : "transparent",
                color: isActive ? "#ffffff" : "rgba(192,212,208,0.7)",
              }}
              onMouseEnter={(e) => {
                if (!isActive)
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(192,212,208,0.06)";
              }}
              onMouseLeave={(e) => {
                if (!isActive)
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
              }}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
              {key === "contratos" && (
                <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                  Novo
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div
        className="px-3 py-3 mt-auto shrink-0"
        style={{ borderTop: "1px solid rgba(192,212,208,0.08)" }}
      >
        <div className="flex items-center gap-2.5 mb-2">
          <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 bg-primary text-primary-foreground">
            {userInitials}
          </div>
          <div className="min-w-0">
            <p
              className="text-[12px] font-medium leading-tight truncate"
              style={{ color: "rgba(192,212,208,0.9)" }}
            >
              {profile?.full_name || "Usuário"}
            </p>
            <p
              className="text-[10px] leading-tight"
              style={{ color: "rgba(192,212,208,0.45)" }}
            >
              {profile?.role === "gestor" ? "Gestor" : "Admin"}
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] transition-colors"
          style={{ color: "rgba(192,212,208,0.5)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "rgba(192,212,208,0.06)";
            (e.currentTarget as HTMLElement).style.color =
              "rgba(192,212,208,0.9)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color =
              "rgba(192,212,208,0.5)";
          }}
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    </aside>
  );

  const renderPage = () => {
    switch (activePage) {
      case "visao-geral":
        return (
          <VisaoGeralPage
            byTeam={byTeam ?? []}
            loading={loading}
            dataWarnings={dataWarnings}
            globalKpis={g}
            onViewTeamDetails={setDetailTeamId}
          />
        );
      case "historico":
        return <AdminHistoricoPage />;
      case "capacidade":
        return <AdminCapacidadePage />;
      case "times":
        return <AdminTimesPage />;
      case "usuarios":
        return <AdminUsuariosPage />;
      case "projetos":
        return <ProjetosAdminPanel />;
      case "ias":
        return <AdminIAsPage />;
      case "contratos":
        return <AdminContratosPage />;
      case "empresas":
        return <AdminEmpresasPage />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="flex-1 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="ml-auto">
            <Sidebar mobile />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-screen lg:ml-60">
        <header
          className="sticky top-0 z-20 flex items-center gap-3 h-14 px-4 lg:px-6 shrink-0"
          style={{
            backgroundColor: topBarBg,
            borderBottom: "1px solid hsl(var(--border))",
            isolation: "isolate",
          }}
        >
          <button
            className="lg:hidden flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors shrink-0"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="flex flex-col items-start justify-center min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-bold leading-none tracking-tight truncate">
                {activeLabel}
              </h1>
              {loading && isVisaoGeral && (
                <RefreshCw
                  className="h-3 w-3 text-muted-foreground animate-spin shrink-0"
                  aria-label="Carregando"
                />
              )}
            </div>
            {isVisaoGeral && (
              <div className="flex items-center gap-1.5 mt-[3px]">
                <span className="text-xs font-semibold text-foreground truncate">
                  {selectedContract?.name ?? "CONTRATO DE FABRICA PF"}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                  · Última atualização: {lastUpdatedLabel}
                </span>
              </div>
            )}
          </div>

          <div className="hidden lg:flex flex-col items-end shrink-0">
            <span className="text-[11px] text-muted-foreground capitalize leading-none">
              {dataLabel}
            </span>
            <span className="text-[13px] font-semibold tabular-nums leading-tight mt-0.5">
              {horaLabel}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <NotificationBell
              notifications={notifications}
              criticalCount={criticalCount}
              warningCount={warningCount}
            />
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">{renderPage()}</main>

        <footer className="text-center text-[11px] text-muted-foreground py-3 border-t px-4">
          Axion Admin © 2026 · Todos os direitos reservados.
        </footer>
      </div>

      <TeamDetailDrawer
        teamId={detailTeamId}
        open={!!detailTeamId}
        onClose={() => setDetailTeamId(null)}
        allKpis={byTeam ?? []}
      />
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <ContractProvider>
      <AdminDashboardInner />
    </ContractProvider>
  );
}
